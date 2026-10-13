import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

let db
try {
  if (!process.env.DATABASE_URL) throw new Error('Missing configuration')
  db = new PrismaClient({ adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
  }) })
  await db.$queryRaw`SELECT 1`
  console.log('Conexión PostgreSQL correcta.')
} catch {
  console.error('No se pudo conectar a PostgreSQL. Revisa .env y el servicio local.')
  process.exitCode = 1
} finally {
  await db?.$disconnect()
}
