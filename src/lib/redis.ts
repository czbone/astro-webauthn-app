import Redis from 'ioredis'
import { participantEnv } from '@/server/env'

const globalForRedis = globalThis as unknown as {
  redis?: Redis
}

export const redis =
  globalForRedis.redis ??
  new Redis(participantEnv.redisUrl(), {
    maxRetriesPerRequest: 1,
    lazyConnect: true
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

redis.on('error', (err: Error) => {
  console.error('Redis connection error:', err.message)
})
