import { beforeEach, describe, expect, it } from 'vitest'
import { cookieStore } from '@/server/auth/cookie-store'
import { HANDOFF_COOKIE, SESSION_COOKIE } from '@/server/auth/cookies'
import { handleLogout } from '@/server/auth/logout'
import { hashToken } from '@/server/auth/tokens'
import { RedisKeys } from '@/server/redis/keys'
import {
  addSessionIndex,
  getAdminRedis,
  indexMembers,
  putSession,
  resetStores,
  seedAccessUser,
  sessionValue
} from '@/test/integration-db'
import { APP_ID, APP_ORIGIN } from '@/test/integration-env'
import { logoutRequest } from '@/test/integration-requests'

const user = { id: 'user-1', email: 'a@example.com', name: '参加者' }

function cleared(cookies: readonly string[], name: string): boolean {
  return cookies.some((line) => line.startsWith(`${name}=`) && line.includes('Max-Age=0'))
}

async function runLogout(
  request: Request
): Promise<{ response: Response; cookies: readonly string[] }> {
  return cookieStore.run(async () => {
    const response = await handleLogout(request)
    return { response, cookies: [...cookieStore.current()] }
  })
}

describe('handleLogout', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('オリジンが違うときは 403 でセッションを残す', async () => {
    const token = 'token-origin'
    await seedAccessUser({ ...user, permission: 'admin' })
    await putSession(APP_ID, token, user.id)
    await addSessionIndex(user.id, APP_ID, token)

    const { response, cookies } = await runLogout(logoutRequest(token, 'http://evil.example'))
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('オリジンが不正です')
    expect(cookies).toEqual([])
    expect(await sessionValue(APP_ID, token)).not.toBeNull()
    expect(await indexMembers(user.id)).toEqual([
      RedisKeys.sessionUserMember(APP_ID, hashToken(token))
    ])
  })

  it('付与が無くても全セッションと索引を消す', async () => {
    const token = 'token-no-grant'
    const otherToken = 'token-other'
    const strangerToken = 'token-stranger'
    await seedAccessUser(user)
    await putSession(APP_ID, token, user.id)
    await putSession('other', otherToken, user.id)
    await putSession('other', strangerToken, 'user-2')
    await addSessionIndex(user.id, APP_ID, token)
    await addSessionIndex(user.id, 'other', otherToken)
    await addSessionIndex('user-2', 'other', strangerToken)
    await getAdminRedis().sadd(RedisKeys.sessionUser(user.id), 'not-a-member')

    const { response, cookies } = await runLogout(logoutRequest(token))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/logged-out')
    expect(cleared(cookies, SESSION_COOKIE)).toBe(true)
    expect(cleared(cookies, HANDOFF_COOKIE)).toBe(true)
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await sessionValue('other', otherToken)).toBeNull()
    expect(await sessionValue('other', strangerToken)).not.toBeNull()
    expect(await indexMembers(user.id)).toEqual([])
    expect(await indexMembers('user-2')).toEqual([
      RedisKeys.sessionUserMember('other', hashToken(strangerToken))
    ])
  })

  it('パスキーが無くても全セッションと索引を消す', async () => {
    const token = 'token-no-passkey'
    const otherToken = 'token-no-passkey-other'
    await seedAccessUser({ ...user, permission: 'allow', passkey: false })
    await putSession(APP_ID, token, user.id)
    await putSession('auth', otherToken, user.id)
    await addSessionIndex(user.id, APP_ID, token)
    await addSessionIndex(user.id, 'auth', otherToken)

    const { response, cookies } = await runLogout(logoutRequest(token, APP_ORIGIN))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/logged-out')
    expect(cleared(cookies, SESSION_COOKIE)).toBe(true)
    expect(cleared(cookies, HANDOFF_COOKIE)).toBe(true)
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await sessionValue('auth', otherToken)).toBeNull()
    expect(await indexMembers(user.id)).toEqual([])
  })

  it('索引に無い自分のセッションも消す', async () => {
    const token = 'token-unindexed'
    await seedAccessUser({ ...user, permission: 'allow' })
    await putSession(APP_ID, token, user.id)

    const { response } = await runLogout(logoutRequest(token))
    expect(response.status).toBe(303)
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await indexMembers(user.id)).toEqual([])
  })

  it('無効なユーザーは全失効したあと 401 になる', async () => {
    const token = 'token-disabled'
    const otherToken = 'token-disabled-other'
    await seedAccessUser({
      ...user,
      permission: 'allow',
      disabledAt: new Date('2026-01-01T00:00:00Z')
    })
    await putSession(APP_ID, token, user.id)
    await putSession('other', otherToken, user.id)
    await addSessionIndex(user.id, APP_ID, token)
    await addSessionIndex(user.id, 'other', otherToken)

    const { response, cookies } = await runLogout(logoutRequest(token))
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('ログインが必要です')
    expect(cleared(cookies, SESSION_COOKIE)).toBe(true)
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await sessionValue('other', otherToken)).toBeNull()
    expect(await indexMembers(user.id)).toEqual([])
  })
})
