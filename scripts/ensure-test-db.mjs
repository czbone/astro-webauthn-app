import 'dotenv/config'
import pg from 'pg'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Example: postgresql://postgres:postgres@localhost:5432/astro_webauthn_app_test?schema=public'
  )
}

const url = new URL(testUrl)
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''))
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
  throw new Error('TEST_DATABASE_URL database name must be a simple identifier')
}

function isMissingDatabase(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '3D000'
}

const existing = new pg.Client({ connectionString: testUrl })
try {
  await existing.connect()
  console.log(`データベース ${dbName} は既にあります`)
} catch (error) {
  if (!isMissingDatabase(error)) throw error
  const admin = new URL(testUrl)
  admin.pathname = '/postgres'
  const creator = new pg.Client({ connectionString: admin.toString() })
  await creator.connect()
  await creator.query(`CREATE DATABASE ${dbName}`)
  await creator.end()
  console.log(`データベース ${dbName} を作成しました`)
} finally {
  await existing.end().catch(() => {})
}
