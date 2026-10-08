import { beforeEach, describe, expect, it } from 'vitest'
import { resolveAccess, slideSession } from '@/server/auth/access'
import { cookieStore } from '@/server/auth/cookie-store'
import { hashToken } from '@/server/auth/tokens'
import { RedisKeys } from '@/server/redis/keys'
import {
  addSessionIndex,
  indexMembers,
  putRawSession,
  putSession,
  resetStores,
  seedAccessUser,
  sessionTtl,
  sessionValue
} from '@/test/integration-db'
import { APP_ID, SESSION_MAX_AGE_SECONDS, SESSION_TTL_SECONDS } from '@/test/integration-env'

const user = { id: 'user-1', email: 'a@example.com', name: '参加者' }

async function expectTtlUnchanged(token: string): Promise<void> {
  const ttl = await sessionTtl(APP_ID, token)
  expect(ttl).toBeGreaterThan(15)
  expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS)
}

describe('resolveAccess', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('トークンが無いときはセッションを消さない', async () => {
    await putSession(APP_ID, 'kept', user.id)
    await expect(resolveAccess(null)).resolves.toEqual({ kind: 'anonymous', clearSession: false })
    expect(await sessionValue(APP_ID, 'kept')).not.toBeNull()
  })

  it('セッションキーが無いときは索引を残して未認証にする', async () => {
    const token = 'missing-session'
    await addSessionIndex(user.id, APP_ID, token)
    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'anonymous', clearSession: true })
    expect(await indexMembers(user.id)).toEqual([
      RedisKeys.sessionUserMember(APP_ID, hashToken(token))
    ])
  })

  it('壊れた JSON はセッションだけ消し、索引は残す', async () => {
    const token = 'bad-json'
    await putRawSession(APP_ID, token, 'not-json')
    await addSessionIndex(user.id, APP_ID, token)
    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'anonymous', clearSession: true })
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await indexMembers(user.id)).toEqual([
      RedisKeys.sessionUserMember(APP_ID, hashToken(token))
    ])
  })

  it('別アプリの appId は自分のセッションと索引要素だけ外す', async () => {
    const token = 'other-app'
    await putRawSession(APP_ID, token, JSON.stringify({ userId: user.id, appId: 'other' }))
    await putSession('other', token, user.id)
    await addSessionIndex(user.id, APP_ID, token)
    await addSessionIndex(user.id, 'other', token)

    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'anonymous', clearSession: true })
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await sessionValue('other', token)).not.toBeNull()
    expect(await indexMembers(user.id)).toEqual([
      RedisKeys.sessionUserMember('other', hashToken(token))
    ])
  })

  it('ユーザーが無いときはセッションと自分の索引要素を消す', async () => {
    const token = 'missing-user'
    await putSession(APP_ID, token, 'missing-user')
    await addSessionIndex('missing-user', APP_ID, token)
    await addSessionIndex('missing-user', 'other', token)

    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'anonymous', clearSession: true })
    expect(await sessionValue(APP_ID, token)).toBeNull()
    expect(await indexMembers('missing-user')).toEqual([
      RedisKeys.sessionUserMember('other', hashToken(token))
    ])
  })

  it('パスキーが無いときは寿命を延ばさない', async () => {
    const token = 'no-passkey'
    await seedAccessUser({ ...user, permission: 'admin', passkey: false })
    await putSession(APP_ID, token, user.id)
    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'no-passkey' })
    expect(await sessionValue(APP_ID, token)).not.toBeNull()
    await expectTtlUnchanged(token)
  })

  it('付与が無いときは寿命を延ばさない', async () => {
    const token = 'no-grant'
    await seedAccessUser(user)
    await putSession(APP_ID, token, user.id)
    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'no-grant', user })
    await expectTtlUnchanged(token)
  })

  it('admin と user 以外の付与は付与なしにする', async () => {
    const token = 'guest'
    await seedAccessUser({ ...user, permission: 'guest' })
    await putSession(APP_ID, token, user.id)
    await expect(resolveAccess(token)).resolves.toEqual({ kind: 'no-grant', user })
    await expectTtlUnchanged(token)
  })

  it.each(['admin', 'user'] as const)(
    '権限が %s なら続行し、寿命はまだ延ばさない',
    async (permission) => {
      const token = `token-${permission}`
      await seedAccessUser({ ...user, permission })
      await putSession(APP_ID, token, user.id)
      await expect(resolveAccess(token)).resolves.toEqual({
        kind: 'ok',
        user,
        permission,
        token,
        tokenHash: hashToken(token)
      })
      await expectTtlUnchanged(token)
    }
  )
})

describe('slideSession', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('セッションの寿命と Cookie の Max-Age を戻す', async () => {
    const token = 'token-slide'
    await putSession(APP_ID, token, user.id)
    await cookieStore.run(async () => {
      await slideSession(token, hashToken(token))
      const line = cookieStore.current().find((value) => value.startsWith('__Host-session='))
      expect(line).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`)
    })
    const ttl = await sessionTtl(APP_ID, token)
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS)
    expect(ttl).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS)
  })
})
