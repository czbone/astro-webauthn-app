import { participantEnv } from '@/server/env'
import { participantRedis } from '@/server/redis/client'
import { RedisKeys } from '@/server/redis/keys'

/** 索引要素 `{appId}/{tokenHash}` を分ける。解釈できない要素は null。 */
export function parseIndexMember(member: string): { appId: string; tokenHash: string } | null {
  const slash = member.indexOf('/')
  if (slash <= 0 || slash === member.length - 1) return null
  return { appId: member.slice(0, slash), tokenHash: member.slice(slash + 1) }
}

/** 索引に載る全セッションと、今読んでいる自セッションと、索引そのものを消す。 */
export async function revokeAllSessions(userId: string, tokenHash: string): Promise<void> {
  const members = await participantRedis.smembers(RedisKeys.sessionUser(userId))
  const sessionKeys = members.flatMap((member) => {
    const parsed = parseIndexMember(member)
    return parsed ? [RedisKeys.session(parsed.appId, parsed.tokenHash)] : []
  })
  sessionKeys.push(RedisKeys.session(participantEnv.appId(), tokenHash))
  await participantRedis.del(...sessionKeys)
  await participantRedis.del(RedisKeys.sessionUser(userId))
}
