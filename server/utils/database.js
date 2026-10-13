import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Database configuration missing')
  if (!globalThis.__fitnessDatabase) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
    })
    globalThis.__fitnessDatabase = new PrismaClient({ adapter })
  }
  return globalThis.__fitnessDatabase
}
