import { HANDOFF_COOKIE, SESSION_COOKIE } from '@/server/auth/cookies'
import { APP_ORIGIN } from './integration-env'

export function callbackRequest(input: {
  code: string
  state: string
  cookieState?: string
  returnPath?: string
}): Request {
  const url = new URL('/callback', APP_ORIGIN)
  url.searchParams.set('code', input.code)
  url.searchParams.set('state', input.state)
  const raw = JSON.stringify({
    state: input.cookieState ?? input.state,
    returnPath: input.returnPath ?? '/grants'
  })
  return new Request(url, {
    headers: { cookie: `${HANDOFF_COOKIE}=${encodeURIComponent(raw)}` }
  })
}

export function logoutRequest(token: string | null, origin: string | null = APP_ORIGIN): Request {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  if (token) headers.set('cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}`)
  return new Request(new URL('/logout', APP_ORIGIN), { method: 'POST', headers })
}
