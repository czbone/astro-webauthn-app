import { HANDOFF_COOKIE, readCookie, setHandoffCookie } from '@/server/auth/cookies'
import { classifySessionValue } from '@/server/auth/session-record'
import { sanitizeReturnPath } from '@/server/auth/return-path'
import {
  hashToken,
  isHandoffState,
  generateToken,
  timingSafeEqualString
} from '@/server/auth/tokens'
import { participantEnv } from '@/server/env'
import { participantRedis } from '@/server/redis/client'
import { RedisKeys } from '@/server/redis/keys'

export type HandoffResult = { ok: true; token: string; returnPath: string } | { ok: false }

type HandoffCookie = {
  state: string
  returnPath: string
}

type HandoffRecord = {
  token: string
  userId: string
  state: string
  redirectUri: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseHandoffCookie(raw: string): HandoffCookie | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (typeof parsed.state !== 'string' || typeof parsed.returnPath !== 'string') return null
  return { state: parsed.state, returnPath: parsed.returnPath }
}

function parseHandoffRecord(raw: string): HandoffRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (
    typeof parsed.token !== 'string' ||
    typeof parsed.userId !== 'string' ||
    typeof parsed.state !== 'string' ||
    typeof parsed.redirectUri !== 'string'
  ) {
    return null
  }
  if (!parsed.token || !parsed.userId) return null
  return {
    token: parsed.token,
    userId: parsed.userId,
    state: parsed.state,
    redirectUri: parsed.redirectUri
  }
}

export function startHandoff(request: Request): Response {
  const url = new URL(request.url)
  const state = generateToken()
  const returnPath = sanitizeReturnPath(`${url.pathname}${url.search}`)
  setHandoffCookie(JSON.stringify({ state, returnPath }))
  const target = new URL('/auth/handoff', participantEnv.authOrigin())
  target.searchParams.set('app', participantEnv.appId())
  target.searchParams.set('redirect_uri', participantEnv.callbackUri())
  target.searchParams.set('state', state)
  return Response.redirect(target, 302)
}

export async function consumeHandoff(request: Request): Promise<HandoffResult> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieRaw = readCookie(request, HANDOFF_COOKIE)
  const cookie = cookieRaw ? parseHandoffCookie(cookieRaw) : null

  if (!code || !state || !isHandoffState(state) || !cookie) return { ok: false }
  if (!timingSafeEqualString(cookie.state, state)) return { ok: false }

  const raw = await participantRedis.getdel(
    RedisKeys.handoff(participantEnv.appId(), hashToken(code))
  )
  if (!raw) return { ok: false }

  const record = parseHandoffRecord(raw)
  if (!record) return { ok: false }
  if (!timingSafeEqualString(record.state, state)) return { ok: false }
  if (!timingSafeEqualString(record.redirectUri, participantEnv.callbackUri())) return { ok: false }

  const sessionRaw = await participantRedis.get(
    RedisKeys.session(participantEnv.appId(), hashToken(record.token))
  )
  const session = classifySessionValue(sessionRaw, participantEnv.appId())
  if (session.action !== 'ok' || !timingSafeEqualString(session.userId, record.userId)) {
    return { ok: false }
  }

  return { ok: true, token: record.token, returnPath: sanitizeReturnPath(cookie.returnPath) }
}
