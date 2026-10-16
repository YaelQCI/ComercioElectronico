import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

if (process.env.DEPLOY_ENVIRONMENT !== 'production' || process.env.NUXT_DEMO_DATA_ENABLED !== 'false') throw Error('Operación exclusiva del entorno de producción sin DEMO.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  const result = await db.$transaction(async tx => {
    const products = await tx.product.findMany({ where: { brand: { slug: 'tfs-demostracion-academica' }, slug: { startsWith: 'demo-' }, publishedAt: { not: null } }, select: { id: true } })
    if (products.length) {
      await tx.product.updateMany({ where: { id: { in: products.map(product => product.id) } }, data: { publishedAt: null } })
      await tx.auditEvent.createMany({ data: products.map(product => ({ actorType: 'SYSTEM', entityType: 'Product', entityId: product.id, action: 'HIDE_PRODUCTION_DEMO', reason: 'El catálogo académico no se publica en producción.', safeAfter: { published: false, demo: true }, correlationId: randomUUID() })) })
    }
    const emails = Array.from({ length: 6 }, (_, index) => `cliente${String(index + 1).padStart(2, '0')}@demo.example.invalid`)
    const candidates = await tx.user.findMany({ where: { emailNormalized: { in: emails }, role: 'CUSTOMER', passwordHash: 'DEMO_ACCOUNT_WITHOUT_LOGIN', deletedAt: null }, select: { id: true } })
    const origins = await tx.auditEvent.findMany({ where: { entityType: 'User', action: 'INITIALIZE_DEMO_CUSTOMER', actorType: 'SYSTEM', entityId: { in: candidates.map(user => user.id) } }, select: { entityId: true } })
    const ids = origins.map(event => event.entityId)
    if (ids.length) {
      await tx.user.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), authVersion: { increment: 1 } } })
      await tx.authSession.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: 'Cuenta DEMO deshabilitada en producción' } })
      await tx.auditEvent.createMany({ data: ids.map(id => ({ actorType: 'SYSTEM', entityType: 'User', entityId: id, action: 'DEACTIVATE_PRODUCTION_DEMO', reason: 'Las cuentas académicas de las migraciones no se habilitan en producción.', safeAfter: { deactivated: true, demo: true }, correlationId: randomUUID() })) })
    }
    return { products: products.length, users: ids.length }
  })
  console.log(`Productos DEMO retirados: ${result.products}; cuentas DEMO desactivadas: ${result.users}. No se eliminaron registros.`)
} finally { await db.$disconnect() }
