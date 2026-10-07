import 'dotenv/config'

const APP_ID_PATTERN = /^[a-z0-9-]{1,32}$/
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function normalizeOrigin(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password || url.search || url.hash) return null
  if (url.pathname !== '/' && url.pathname !== '') return null
  return url.origin
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export function sessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE_SECONDS
  if (!raw) return DEFAULT_SESSION_MAX_AGE_SECONDS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('SESSION_MAX_AGE_SECONDS must be a positive integer')
  }
  return parsed
}

function assertProductionOrigin(name: string, origin: string): void {
  const url = new URL(origin)
  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use https in production`)
  }
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error(`${name} must not use localhost in production`)
  }
}

export function validateRuntimeEnv(): void {
  const appId = required('APP_ID')
  if (!APP_ID_PATTERN.test(appId)) {
    throw new Error('APP_ID must match ^[a-z0-9-]{1,32}$')
  }
  const appOrigin = normalizeOrigin(required('APP_ORIGIN'))
  if (!appOrigin) throw new Error('APP_ORIGIN must be an origin without a path')
  const authOrigin = normalizeOrigin(required('AUTH_ORIGIN'))
  if (!authOrigin) throw new Error('AUTH_ORIGIN must be an origin without a path')
  if (appOrigin === authOrigin) {
    throw new Error('APP_ORIGIN must differ from AUTH_ORIGIN')
  }
  required('DATABASE_URL')
  required('REDIS_URL')
  sessionMaxAgeSeconds()
  if (process.env.NODE_ENV === 'production') {
    assertProductionOrigin('APP_ORIGIN', appOrigin)
    assertProductionOrigin('AUTH_ORIGIN', authOrigin)
  }
}

function originEnv(name: string): string {
  const origin = normalizeOrigin(process.env[name] ?? '')
  if (!origin) throw new Error(`${name} is invalid`)
  return origin
}

export const participantEnv = {
  isProduction: (): boolean => process.env.NODE_ENV === 'production',
  appId: (): string => {
    const value = process.env.APP_ID ?? ''
    if (!APP_ID_PATTERN.test(value)) throw new Error('APP_ID is invalid')
    return value
  },
  appOrigin: (): string => originEnv('APP_ORIGIN'),
  authOrigin: (): string => originEnv('AUTH_ORIGIN'),
  callbackUri: (): string => `${participantEnv.appOrigin()}/callback`,
  setupPasskeyUrl: (): string => `${participantEnv.authOrigin()}/setup-passkey`,
  databaseUrl: (): string => required('DATABASE_URL'),
  redisUrl: (): string => required('REDIS_URL'),
  redisKeyPrefix: (): string => process.env.REDIS_KEY_PREFIX ?? '',
  sessionMaxAgeSeconds
}
