import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const APP_ID = 'app'
export const APP_ORIGIN = 'http://app.localhost:4000'
export const AUTH_ORIGIN = 'http://auth.localhost:3000'
export const SESSION_MAX_AGE_SECONDS = 120
export const SESSION_TTL_SECONDS = 40
export const PARTICIPANT_USER = 'app_participant_itest'
export const PARTICIPANT_PASSWORD = 'participant_itest_secret'
export const INTEGRATION_KEY_ROOT = 'awa-itest:'

const STATE_FILE = path.join(os.tmpdir(), 'astro-webauthn-app-integration.json')

type IntegrationState = {
  prefix: string
}

export function databaseName(connectionString: string): string {
  const url = new URL(connectionString)
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('TEST_DATABASE_URL database name must be a simple identifier')
  }
  return name
}

export function databaseIdentity(connectionString: string): string {
  const url = new URL(connectionString)
  const port = url.port || '5432'
  return `${url.hostname}:${port}:${databaseName(connectionString)}`
}

export function assertDistinctDatabase(): void {
  const testUrl = process.env.TEST_DATABASE_URL
  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Point it at a dedicated database on the running Postgres, separate from DATABASE_URL. Example: postgresql://postgres:postgres@localhost:5432/astro_webauthn_app_test?schema=public'
    )
  }
  const appUrl = process.env.DATABASE_URL
  if (appUrl && databaseIdentity(appUrl) === databaseIdentity(testUrl)) {
    throw new Error('TEST_DATABASE_URL must not use the same database as DATABASE_URL')
  }
}

export function writeIntegrationState(prefix: string): void {
  assertPrefix(prefix)
  fs.writeFileSync(STATE_FILE, JSON.stringify({ prefix }))
}

export function readIntegrationState(): IntegrationState {
  let raw: string
  try {
    raw = fs.readFileSync(STATE_FILE, 'utf8')
  } catch {
    throw new Error(
      'Integration globalSetup did not run. Run pnpm test:integration so the test database and Redis user are prepared.'
    )
  }
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || !('prefix' in parsed)) {
    throw new Error('integration state file is invalid')
  }
  const prefix = parsed.prefix
  if (typeof prefix !== 'string') throw new Error('integration state file is invalid')
  assertPrefix(prefix)
  return { prefix }
}

export function removeIntegrationState(): void {
  fs.rmSync(STATE_FILE, { force: true })
}

export function adminRedisUrl(): string {
  return process.env.TEST_REDIS_URL || 'redis://localhost:6379/'
}

export function participantDatabaseUrl(adminUrl: string): string {
  const url = new URL(adminUrl)
  url.username = PARTICIPANT_USER
  url.password = PARTICIPANT_PASSWORD
  return url.toString()
}

export function participantRedisUrl(): string {
  const url = new URL(adminRedisUrl())
  url.username = PARTICIPANT_USER
  url.password = PARTICIPANT_PASSWORD
  return url.toString()
}

export function applyIntegrationEnv(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is not set')
  }
  const prefix = process.env.INTEGRATION_REDIS_PREFIX
  if (!prefix) {
    throw new Error('INTEGRATION_REDIS_PREFIX is not set')
  }
  assertPrefix(prefix)
  process.env.REDIS_KEY_PREFIX = prefix
  process.env.DATABASE_URL = participantDatabaseUrl(testDatabaseUrl)
  process.env.REDIS_URL = participantRedisUrl()
  process.env.APP_ID = APP_ID
  process.env.APP_ORIGIN = APP_ORIGIN
  process.env.AUTH_ORIGIN = AUTH_ORIGIN
  process.env.SESSION_MAX_AGE_SECONDS = String(SESSION_MAX_AGE_SECONDS)
}

export function assertPrefix(prefix: string): void {
  if (
    !prefix.startsWith(INTEGRATION_KEY_ROOT) ||
    prefix.includes(' ') ||
    prefix.includes('(') ||
    prefix.includes(')')
  ) {
    throw new Error('integration Redis prefix is invalid')
  }
}
