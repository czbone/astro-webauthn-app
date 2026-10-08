import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Redis from 'ioredis'
import pg from 'pg'
import { deleteRedisByPattern, closeAdmin } from './integration-db'
import {
  INTEGRATION_KEY_ROOT,
  PARTICIPANT_PASSWORD,
  PARTICIPANT_USER,
  adminRedisUrl,
  applyIntegrationEnv,
  assertDistinctDatabase,
  databaseName,
  removeIntegrationState,
  writeIntegrationState
} from './integration-env'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql')

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function adminRedis(): Redis {
  const client = new Redis(adminRedisUrl(), {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
    retryStrategy: () => null
  })
  client.on('error', () => {})
  return client
}

async function prepareDatabase(adminUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: adminUrl, connectionTimeoutMillis: 5000 })
  pool.on('error', () => {})
  const dbName = databaseName(adminUrl)
  const password = PARTICIPANT_PASSWORD.replaceAll("'", "''")
  try {
    await pool.query(fs.readFileSync(schemaPath, 'utf8'))
    const existingRole = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [
      PARTICIPANT_USER
    ])
    if ((existingRole.rowCount ?? 0) === 0) {
      await pool.query(`CREATE ROLE ${PARTICIPANT_USER} LOGIN PASSWORD '${password}'`)
    } else {
      await pool.query(`ALTER ROLE ${PARTICIPANT_USER} WITH LOGIN PASSWORD '${password}'`)
    }
    await pool.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${PARTICIPANT_USER}`)
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${PARTICIPANT_USER}`)
    await pool.query(`REVOKE ALL ON TABLE "User" FROM ${PARTICIPANT_USER}`)
    await pool.query(`REVOKE ALL ON TABLE "WebAuthnCredential" FROM ${PARTICIPANT_USER}`)
    await pool.query(`REVOKE ALL ON TABLE "App" FROM ${PARTICIPANT_USER}`)
    await pool.query(`REVOKE ALL ON TABLE "AppGrant" FROM ${PARTICIPANT_USER}`)
    await pool.query(`GRANT SELECT (id, email, name) ON TABLE "User" TO ${PARTICIPANT_USER}`)
    await pool.query(
      `GRANT SELECT (id, "userId") ON TABLE "WebAuthnCredential" TO ${PARTICIPANT_USER}`
    )
    await pool.query(`GRANT SELECT ON TABLE "App" TO ${PARTICIPANT_USER}`)
    await pool.query(`GRANT SELECT ON TABLE "AppGrant" TO ${PARTICIPANT_USER}`)
  } catch (error) {
    throw new Error(
      `Failed to prepare the integration database. TEST_DATABASE_URL must be able to create tables and roles. ${errorMessage(error)}`,
      { cause: error }
    )
  } finally {
    await pool.end()
  }
}

async function prepareRedis(prefix: string): Promise<void> {
  const client = adminRedis()
  try {
    await client.connect()
    await deleteRedisByPattern(`${INTEGRATION_KEY_ROOT}*`)
    await client.call(
      'ACL',
      'SETUSER',
      PARTICIPANT_USER,
      'reset',
      'on',
      `>${PARTICIPANT_PASSWORD}`,
      '+info',
      `(~${prefix}sess:* +get +expire +del)`,
      `(~${prefix}handoff:* +get +getdel +del)`,
      `(~${prefix}sess:user:* +srem)`
    )
  } catch (error) {
    throw new Error(
      `Failed to prepare Redis. TEST_REDIS_URL must allow SET and ACL SETUSER. ${errorMessage(error)}`,
      { cause: error }
    )
  } finally {
    client.disconnect()
  }
}

async function removeRedisUser(): Promise<void> {
  const client = adminRedis()
  try {
    await client.connect()
    await client.call('ACL', 'DELUSER', PARTICIPANT_USER)
    await deleteRedisByPattern(`${INTEGRATION_KEY_ROOT}*`)
  } catch {
    // サーバが既に止まっていても、テスト結果は変えない
  } finally {
    client.disconnect()
  }
}

export default async function setup(): Promise<() => Promise<void>> {
  assertDistinctDatabase()
  const testDatabaseUrl = process.env.TEST_DATABASE_URL
  if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set')
  const prefix = `${INTEGRATION_KEY_ROOT}${process.pid}:`
  process.env.INTEGRATION_REDIS_PREFIX = prefix
  writeIntegrationState(prefix)
  try {
    await prepareDatabase(testDatabaseUrl)
    await prepareRedis(prefix)
    applyIntegrationEnv()
  } catch (error) {
    removeIntegrationState()
    throw error
  } finally {
    await closeAdmin()
  }
  return async () => {
    await removeRedisUser()
    await closeAdmin()
    removeIntegrationState()
  }
}
