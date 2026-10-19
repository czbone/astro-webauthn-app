import {
  countCredentials,
  findAppDefault,
  findGrantPermission,
  findUserById,
  type PublicUser
} from '@/server/db/read'
import { effectivePermission } from '@/server/auth/permission'
import { setSessionCookie } from '@/server/auth/cookies'
import { classifySessionValue } from '@/server/auth/session-record'
import { hashToken } from '@/server/auth/tokens'
import { participantEnv } from '@/server/env'
import { participantRedis } from '@/server/redis/client'
import { RedisKeys } from '@/server/redis/keys'

export type { PublicUser }

export type PageAccess =
  { kind: 'public' } | { kind: 'no-grant'; user: PublicUser } | { kind: 'ok'; user: PublicUser }

export type AccessResult =
  | { kind: 'anonymous'; clearSession: boolean }
  | { kind: 'no-passkey' }
  | { kind: 'no-grant'; user: PublicUser }
  | { kind: 'ok'; user: PublicUser; token: string; tokenHash: string }

function toPublicUser(record: {
  id: string
  email: string
  name: string
  role: string | null
}): PublicUser {
  return { id: record.id, email: record.email, name: record.name, role: record.role }
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

  const record = await findUserById(classified.userId)
  if (!record || record.disabledAt) {
    await dropSession(tokenHash, classified.userId)
    return { kind: 'anonymous', clearSession: true }
  }

  const credentials = await countCredentials(record.id)
  if (credentials === 0) return { kind: 'no-passkey' }

  const grant = await findGrantPermission(record.id, appId)
  const app = await findAppDefault(appId)
  const allowed = effectivePermission({
    appFound: app.found,
    grant,
    defaultPermission: app.found ? app.defaultPermission : null
  })
  const user = toPublicUser(record)
  if (allowed !== 'allow') return { kind: 'no-grant', user }

  return { kind: 'ok', user, token, tokenHash }
}

export async function slideSession(token: string, tokenHash: string): Promise<void> {
  const maxAge = participantEnv.sessionMaxAgeSeconds()
  await participantRedis.expire(RedisKeys.session(participantEnv.appId(), tokenHash), maxAge)
  setSessionCookie(token, maxAge)
}
