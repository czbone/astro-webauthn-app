import { getPrisma } from '@/lib/prisma'

export type PublicUser = {
  id: string
  email: string
  name: string
  role: string | null
}

export type UserRecord = PublicUser & {
  disabledAt: Date | null
}

export type GrantRow = {
  email: string
  name: string
  permission: string
}

export type AppDefault = { found: false } | { found: true; defaultPermission: string | null }

export async function findUserById(id: string): Promise<UserRecord | null> {
  const rows = await getPrisma().$queryRaw<UserRecord[]>`
    SELECT id, email, name, role, "disabledAt" FROM "User" WHERE id = ${id}
  `
  return rows[0] ?? null
}

export async function countCredentials(userId: string): Promise<number> {
  const rows = await getPrisma().$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(id) AS count FROM "WebAuthnCredential" WHERE "userId" = ${userId}
  `
  return Number(rows[0]?.count ?? 0)
}

export async function findGrantPermission(userId: string, appId: string): Promise<string | null> {
  const rows = await getPrisma().$queryRaw<Array<{ permission: string }>>`
    SELECT permission FROM "AppGrant" WHERE "userId" = ${userId} AND "appId" = ${appId}
  `
  return rows[0]?.permission ?? null
}

export async function findAppDefault(appId: string): Promise<AppDefault> {
  const rows = await getPrisma().$queryRaw<Array<{ defaultPermission: string | null }>>`
    SELECT "defaultPermission" FROM "App" WHERE id = ${appId}
  `
  const row = rows[0]
  if (!row) return { found: false }
  return { found: true, defaultPermission: row.defaultPermission }
}

export async function listGrants(appId: string): Promise<GrantRow[]> {
  return getPrisma().$queryRaw<GrantRow[]>`
    SELECT u.email, u.name, g.permission
    FROM "AppGrant" g
    JOIN "User" u ON u.id = g."userId"
    WHERE g."appId" = ${appId}
    ORDER BY u.email ASC
  `
}
