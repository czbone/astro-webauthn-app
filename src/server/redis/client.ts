import { redis } from '@/lib/redis'

/** 参加アプリに許された Redis 操作だけを公開する。SET と SADD は持たない。 */
export const participantRedis = {
  get(key: string): Promise<string | null> {
    return redis.get(key)
  },
  getdel(key: string): Promise<string | null> {
    return redis.getdel(key)
  },
  async expire(key: string, seconds: number): Promise<void> {
    await redis.expire(key, seconds)
  },
  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return
    await redis.del(...keys)
  },
  async srem(key: string, member: string): Promise<void> {
    await redis.srem(key, member)
  },
  smembers(key: string): Promise<string[]> {
    return redis.smembers(key)
  }
}
