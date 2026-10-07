import { participantEnv } from '@/server/env'

export function redisKey(logical: string, prefix = participantEnv.redisKeyPrefix()): string {
  return `${prefix}${logical}`
}

function withPrefix(logical: string, prefix: string | undefined): string {
  if (prefix === undefined) return redisKey(logical)
  return redisKey(logical, prefix)
}

export const RedisKeys = {
  session: (appId: string, tokenHash: string, prefix?: string): string =>
    withPrefix(`sess:${appId}:${tokenHash}`, prefix),
  sessionUser: (userId: string, prefix?: string): string =>
    withPrefix(`sess:user:${userId}`, prefix),
  handoff: (appId: string, codeHash: string, prefix?: string): string =>
    withPrefix(`handoff:${appId}:${codeHash}`, prefix),
  sessionUserMember: (appId: string, tokenHash: string): string => `${appId}/${tokenHash}`
}
