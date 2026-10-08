import Redis from 'ioredis'
import pg from 'pg'
import { hashToken } from '@/server/auth/tokens'
import { RedisKeys } from '@/server/redis/keys'
import {
  APP_ID,
  APP_ORIGIN,
  INTEGRATION_KEY_ROOT,
  SESSION_TTL_SECONDS,
  adminRedisUrl
} from './integration-env'

let adminPool: pg.Pool | undefined
let adminRedis: Redis | undefined

function requiredTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL
  if (!value) throw new Error('TEST_DATABASE_URL is not set')
  return value
}

export function getAdminPool(): pg.Pool {
  if (!adminPool) {
    adminPool = new pg.Pool({
      connectionString: requiredTestDatabaseUrl(),
      connectionTimeoutMillis: 5000
    })
    adminPool.on('error', () => {})
  }
  return adminPool
}

export function getAdminRedis(): Redis {
  if (!adminRedis) {
    adminRedis = new Redis(adminRedisUrl(), {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: () => null
    })
    adminRedis.on('error', () => {})
  }
  return adminRedis
}

export async function closeAdmin(): Promise<void> {
  const pool = adminPool
  adminPool = undefined
  if (pool) await pool.end()
  const client = adminRedis
  adminRedis = undefined
  client?.disconnect()
}

export async function deleteRedisByPattern(match: string): Promise<void> {
  if (!match.startsWith(INTEGRATION_KEY_ROOT)) {
    throw new Error('refusing to delete Redis keys outside the integration prefix')
  }
  const client = getAdminRedis()
  let cursor = '0'
  do {
    // SCAN はカーソルが進むまで次を待てない
    // eslint-disable-next-line no-await-in-loop
    const [next, keys] = await client.scan(cursor, 'MATCH', match, 'COUNT', 200)
    if (!next) throw new Error('Redis SCAN did not return a cursor')
    if (keys && keys.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await client.del(...keys)
    }
    cursor = next
  } while (cursor !== '0')
}

export async function resetStores(): Promise<void> {
  await getAdminPool().query(
    'TRUNCATE TABLE "AppGrant", "WebAuthnCredential", "App", "User" CASCADE'
  )
  const prefix = process.env.REDIS_KEY_PREFIX
  if (!prefix) throw new Error('REDIS_KEY_PREFIX is not set')
  await deleteRedisByPattern(`${prefix}*`)
}

export async function insertUser(input: {
  id: string
  email: string
  name: string
  password?: string
  role?: string
}): Promise<void> {
  await getAdminPool().query(
    'INSERT INTO "User" (id, email, name, password, role) VALUES ($1, $2, $3, $4, $5)',
    [input.id, input.email, input.name, input.password ?? null, input.role ?? null]
  )
}

export async function insertApp(input: {
  id: string
  name: string
  origin: string
  redirectUris?: string[]
}): Promise<void> {
  await getAdminPool().query(
    `INSERT INTO "App" (id, name, origin, "redirectUris")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [input.id, input.name, input.origin, input.redirectUris ?? []]
  )
}

export async function insertGrant(input: {
  id: string
  userId: string
  appId: string
  permission: string
}): Promise<void> {
  await getAdminPool().query(
    'INSERT INTO "AppGrant" (id, "userId", "appId", permission) VALUES ($1, $2, $3, $4)',
    [input.id, input.userId, input.appId, input.permission]
  )
}

export async function insertCredential(userId: string, id: string): Promise<void> {
  await getAdminPool().query('INSERT INTO "WebAuthnCredential" (id, "userId") VALUES ($1, $2)', [
    id,
    userId
  ])
}

export async function seedAccessUser(input: {
  id: string
  email: string
  name: string
  permission?: string
  passkey?: boolean
  appId?: string
}): Promise<void> {
  const appId = input.appId ?? APP_ID
  await insertApp({
    id: appId,
    name: appId,
    origin: appId === APP_ID ? APP_ORIGIN : `http://${appId}.localhost`,
    redirectUris: appId === APP_ID ? [`${APP_ORIGIN}/callback`] : []
  })
  await insertUser({
    id: input.id,
    email: input.email,
    name: input.name,
    password: 'hidden-password',
    role: 'admin'
  })
  if (input.passkey !== false) await insertCredential(input.id, `${input.id}-cred`)
  if (input.permission !== undefined) {
    await insertGrant({
      id: `${input.id}-${appId}`,
      userId: input.id,
      appId,
      permission: input.permission
    })
  }
}

export async function putRawSession(
  appId: string,
  token: string,
  raw: string,
  ttl = SESSION_TTL_SECONDS
): Promise<void> {
  await getAdminRedis().set(RedisKeys.session(appId, hashToken(token)), raw, 'EX', ttl)
}

export async function putSession(
  appId: string,
  token: string,
  userId: string,
  ttl = SESSION_TTL_SECONDS
): Promise<void> {
  await putRawSession(appId, token, JSON.stringify({ userId, appId }), ttl)
}

export async function addSessionIndex(userId: string, appId: string, token: string): Promise<void> {
  await getAdminRedis().sadd(
    RedisKeys.sessionUser(userId),
    RedisKeys.sessionUserMember(appId, hashToken(token))
  )
}

export async function putHandoff(input: {
  code: string
  token: string
  userId: string
  state: string
  redirectUri: string
}): Promise<void> {
  await getAdminRedis().set(
    RedisKeys.handoff(APP_ID, hashToken(input.code)),
    JSON.stringify({
      token: input.token,
      userId: input.userId,
      state: input.state,
      redirectUri: input.redirectUri
    }),
    'EX',
    300
  )
}

export async function sessionValue(appId: string, token: string): Promise<string | null> {
  return getAdminRedis().get(RedisKeys.session(appId, hashToken(token)))
}

export async function sessionTtl(appId: string, token: string): Promise<number> {
  return getAdminRedis().ttl(RedisKeys.session(appId, hashToken(token)))
}

export async function indexMembers(userId: string): Promise<string[]> {
  const members = await getAdminRedis().smembers(RedisKeys.sessionUser(userId))
  return members.sort()
}

export async function handoffValue(code: string): Promise<string | null> {
  return getAdminRedis().get(RedisKeys.handoff(APP_ID, hashToken(code)))
}
