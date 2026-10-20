import { resolveAccess } from '@/server/auth/access'
import {
  clearHandoffCookie,
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE
} from '@/server/auth/cookies'
import { isAllowedOrigin } from '@/server/auth/origin'
import { revokeAllSessions } from '@/server/auth/revoke'
import { redirectNoStore, textResponse } from '@/server/auth/responses'
import { hashToken } from '@/server/auth/tokens'
import { participantEnv } from '@/server/env'

export async function handleLogout(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get('origin'), participantEnv.appOrigin())) {
    return textResponse(403, 'オリジンが不正です')
  }

  const token = readCookie(request, SESSION_COOKIE)
  const access = await resolveAccess(token)
  if (access.kind === 'anonymous') {
    if (access.clearSession) clearSessionCookie()
    return textResponse(401, 'ログインが必要です')
  }
  if (!token) return textResponse(401, 'ログインが必要です')

  await revokeAllSessions(access.user.id, hashToken(token))
  clearSessionCookie()
  clearHandoffCookie()
  return redirectNoStore('/logged-out', 303)
}
