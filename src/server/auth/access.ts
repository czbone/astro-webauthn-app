import {
  countCredentials,
  findGrantPermission,
  findUserById,
  type PublicUser
} from '@/server/db/read'
import type { AppPermission } from '@/server/auth/permission'
import { isAppPermission } from '@/server/auth/permission'
import { setSessionCookie } from '@/server/auth/cookies'
import { classifySessionValue } from '@/server/auth/session-record'
import { hashToken } from '@/server/auth/tokens'
import { participantEnv } from '@/server/env'
import { participantRedis } from '@/server/redis/client'
import { RedisKeys } from '@/server/redis/keys'

export type { PublicUser }

export type PageAccess =
  | { kind: 'public' }
  | { kind: 'no-grant'; user: PublicUser }
  | { kind: 'ok'; user: PublicUser; permission: AppPermission }

export type AccessResult =
  | { kind: 'anonymous'; clearSession: boolean }
  | { kind: 'no-passkey' }
  | { kind: 'no-grant'; user: PublicUser }
  | {
      kind: 'ok'
      user: PublicUser
      permission: AppPermission
      token: string
      tokenHash: string
    }

async function dropSession(tokenHash: string, userId: string | null): Promise<void> {
  const appId = participantEnv.appId()
  await participantRedis.del(RedisKeys.session(appId, tokenHash))
  if (!userId) return
  await participantRedis.srem(
    RedisKeys.sessionUser(userId),
    RedisKeys.sessionUserMember(appId, tokenHash)
  )
}

export async function resolveAccess(token: string | null): Promise<AccessResult> {
  if (!token) return { kind: 'anonymous', clearSession: false }

  const appId = participantEnv.appId()
  const tokenHash = hashToken(token)
  const raw = await participantRedis.get(RedisKeys.session(appId, tokenHash))
  const classified = classifySessionValue(raw, appId)

  if (classified.action === 'missing') return { kind: 'anonymous', clearSession: true }
  if (classified.action === 'drop') {
    await dropSession(tokenHash, classified.userId)
    return { kind: 'anonymous', clearSession: true }
  }

  const user = await findUserById(classified.userId)
  if (!user) {
    await dropSession(tokenHash, classified.userId)
    return { kind: 'anonymous', clearSession: true }
  }

  const credentials = await countCredentials(user.id)
  if (credentials === 0) return { kind: 'no-passkey' }

  const permission = await findGrantPermission(user.id, appId)
  if (!isAppPermission(permission)) return { kind: 'no-grant', user }

  return { kind: 'ok', user, permission, token, tokenHash }
}

export async function slideSession(token: string, tokenHash: string): Promise<void> {
  const maxAge = participantEnv.sessionMaxAgeSeconds()
  await participantRedis.expire(RedisKeys.session(participantEnv.appId(), tokenHash), maxAge)
  setSessionCookie(token, maxAge)
}
