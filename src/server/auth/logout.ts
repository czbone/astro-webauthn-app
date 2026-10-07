import { resolveAccess } from '@/server/auth/access'
import {
  clearHandoffCookie,
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE
} from '@/server/auth/cookies'
import { isAllowedOrigin } from '@/server/auth/origin'
import { redirectNoStore, textResponse } from '@/server/auth/responses'
import { hashToken } from '@/server/auth/tokens'
import { participantEnv } from '@/server/env'
import { participantRedis } from '@/server/redis/client'
import { RedisKeys } from '@/server/redis/keys'

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
  if (access.kind === 'no-passkey') {
    return textResponse(403, '先にパスキーを登録してください')
  }
  if (!token) return textResponse(401, 'ログインが必要です')

  const appId = participantEnv.appId()
  const tokenHash = hashToken(token)
  await participantRedis.del(RedisKeys.session(appId, tokenHash))
  await participantRedis.srem(
    RedisKeys.sessionUser(access.user.id),
    RedisKeys.sessionUserMember(appId, tokenHash)
  )
  clearSessionCookie()
  clearHandoffCookie()
  return redirectNoStore('/logged-out', 303)
}
