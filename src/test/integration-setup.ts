import 'dotenv/config'
import { afterAll } from 'vitest'
import { closeAdmin } from './integration-db'
import { applyIntegrationEnv, readIntegrationState } from './integration-env'

const state = readIntegrationState()
process.env.INTEGRATION_REDIS_PREFIX = state.prefix
applyIntegrationEnv()

afterAll(async () => {
  const { redis } = await import('@/lib/redis')
  const { getPrisma } = await import('@/lib/prisma')
  await getPrisma().$disconnect()
  redis.disconnect()
  await closeAdmin()
  const globals = globalThis as { prisma?: unknown; redis?: unknown }
  globals.prisma = undefined
  globals.redis = undefined
})
