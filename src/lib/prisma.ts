import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { participantEnv } from '@/server/env'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const prisma = new PrismaClient({
    adapter: new PrismaPg(participantEnv.databaseUrl()),
    log: ['error', 'warn']
  })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  return prisma
}
