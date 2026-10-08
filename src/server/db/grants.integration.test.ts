import { beforeEach, describe, expect, it } from 'vitest'
import { listGrants } from '@/server/db/read'
import { insertApp, insertGrant, insertUser, resetStores } from '@/test/integration-db'
import { APP_ID, APP_ORIGIN } from '@/test/integration-env'

describe('listGrants', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('このアプリの付与だけをメールアドレスの昇順で返す', async () => {
    await insertApp({ id: APP_ID, name: '参加', origin: APP_ORIGIN })
    await insertApp({ id: 'other', name: '別', origin: 'http://other.localhost' })
    await insertUser({ id: 'user-m', email: 'm@example.com', name: 'えむ' })
    await insertUser({ id: 'user-a', email: 'a@example.com', name: 'えい' })
    await insertUser({ id: 'user-b', email: 'b@example.com', name: 'びー' })
    await insertGrant({ id: 'g-m', userId: 'user-m', appId: APP_ID, permission: 'admin' })
    await insertGrant({ id: 'g-a', userId: 'user-a', appId: APP_ID, permission: 'user' })
    await insertGrant({ id: 'g-b', userId: 'user-b', appId: 'other', permission: 'admin' })

    await expect(listGrants(APP_ID)).resolves.toEqual([
      { email: 'a@example.com', name: 'えい', permission: 'user' },
      { email: 'm@example.com', name: 'えむ', permission: 'admin' }
    ])
  })
})
