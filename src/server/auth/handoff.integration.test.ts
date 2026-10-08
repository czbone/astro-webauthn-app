import { beforeEach, describe, expect, it } from 'vitest'
import { consumeHandoff } from '@/server/auth/handoff'
import { participantEnv } from '@/server/env'
import {
  handoffValue,
  putHandoff,
  putSession,
  resetStores,
  sessionValue
} from '@/test/integration-db'
import { APP_ORIGIN } from '@/test/integration-env'
import { callbackRequest } from '@/test/integration-requests'

const callbackUri = `${APP_ORIGIN}/callback`

describe('consumeHandoff', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('一致したコードは一度だけ消費できる', async () => {
    expect(participantEnv.callbackUri()).toBe(callbackUri)
    const code = 'code-ok'
    const token = 'token-ok'
    const state = 'state-ok'
    await putSession(participantEnv.appId(), token, 'user-1')
    await putHandoff({ code, token, userId: 'user-1', state, redirectUri: callbackUri })
    const request = callbackRequest({ code, state, returnPath: '/grants' })

    await expect(consumeHandoff(request)).resolves.toEqual({
      ok: true,
      token,
      returnPath: '/grants'
    })
    expect(await handoffValue(code)).toBeNull()
    await expect(consumeHandoff(request)).resolves.toEqual({ ok: false })
  })

  it('Cookie の state が違うときはキーを残す', async () => {
    const code = 'code-cookie'
    await putHandoff({
      code,
      token: 'token-1',
      userId: 'user-1',
      state: 'state-record',
      redirectUri: callbackUri
    })
    const request = callbackRequest({ code, state: 'state-query', cookieState: 'state-cookie' })
    await expect(consumeHandoff(request)).resolves.toEqual({ ok: false })
    expect(await handoffValue(code)).not.toBeNull()
  })

  it('レコードの state が違うときは失敗し、コードは戻らない', async () => {
    const code = 'code-state'
    await putHandoff({
      code,
      token: 'token-1',
      userId: 'user-1',
      state: 'state-record',
      redirectUri: callbackUri
    })
    const request = callbackRequest({ code, state: 'state-query' })
    await expect(consumeHandoff(request)).resolves.toEqual({ ok: false })
    expect(await handoffValue(code)).toBeNull()
  })

  it('redirectUri が違うときは失敗し、コードは戻らない', async () => {
    const code = 'code-uri'
    const state = 'state-uri'
    await putHandoff({
      code,
      token: 'token-1',
      userId: 'user-1',
      state,
      redirectUri: 'http://evil.example/callback'
    })
    const request = callbackRequest({ code, state })
    await expect(consumeHandoff(request)).resolves.toEqual({ ok: false })
    expect(await handoffValue(code)).toBeNull()
  })

  it('セッションの userId が違うときは失敗し、コードは戻らない', async () => {
    const code = 'code-user'
    const token = 'token-user'
    const state = 'state-user'
    await putSession(participantEnv.appId(), token, 'other-user')
    await putHandoff({ code, token, userId: 'user-1', state, redirectUri: callbackUri })
    const request = callbackRequest({ code, state })
    await expect(consumeHandoff(request)).resolves.toEqual({ ok: false })
    expect(await handoffValue(code)).toBeNull()
    expect(await sessionValue(participantEnv.appId(), token)).not.toBeNull()
  })
})
