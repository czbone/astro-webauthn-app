import { beforeEach, describe, expect, it } from 'vitest'
import { redis } from '@/lib/redis'
import { getPrisma } from '@/lib/prisma'
import { findUserById } from '@/server/db/read'
import { RedisKeys } from '@/server/redis/keys'
import { getAdminRedis, resetStores, seedAccessUser } from '@/test/integration-db'
import { APP_ID } from '@/test/integration-env'

describe('参加アプリの接続権限', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('User.password は読めず、id と email と name は読める', async () => {
    const user = { id: 'user-1', email: 'a@example.com', name: '参加者' }
    await seedAccessUser({ ...user, permission: 'user' })
    await expect(getPrisma().$queryRaw`SELECT password FROM "User"`).rejects.toThrow(
      /permission denied/i
    )
    await expect(findUserById(user.id)).resolves.toEqual(user)
  })

  it('セッションキーの SET は拒否し、GET はできる', async () => {
    const key = RedisKeys.session(APP_ID, 'readable')
    await getAdminRedis().set(key, 'ok')
    await expect(redis.get(key)).resolves.toBe('ok')
    await expect(redis.set(key, 'no')).rejects.toThrow(/NOPERM/)
  })
})
