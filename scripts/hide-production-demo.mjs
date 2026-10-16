import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

if (process.env.DEPLOY_ENVIRONMENT !== 'production' || process.env.NUXT_DEMO_DATA_ENABLED !== 'false') throw Error('Operación exclusiva del entorno de producción sin DEMO.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  const count = await db.$transaction(async tx => {
    const products = await tx.product.findMany({ where: { brand: { slug: 'tfs-demostracion-academica' }, slug: { startsWith: 'demo-' }, publishedAt: { not: null } }, select: { id: true } })
    if (!products.length) return 0
    await tx.product.updateMany({ where: { id: { in: products.map(product => product.id) } }, data: { publishedAt: null } })
    await tx.auditEvent.createMany({ data: products.map(product => ({ actorType: 'SYSTEM', entityType: 'Product', entityId: product.id, action: 'HIDE_PRODUCTION_DEMO', reason: 'El catálogo académico no se publica en producción.', safeAfter: { published: false, demo: true }, correlationId: randomUUID() })) })
    return products.length
  })
  console.log(`Productos DEMO retirados de producción: ${count}. No se eliminaron registros.`)
} finally { await db.$disconnect() }
