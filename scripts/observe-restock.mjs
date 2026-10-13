import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { observeRestock, applicationUrl } from '../server/features/restock/restock-worker.js'

const args = process.argv.slice(2)
if (args.some(a => a !== '--apply')) throw new Error('Uso: npm run restock:observe -- [--apply]')
if (!process.env.DATABASE_URL) throw new Error('Configurar DATABASE_URL privada.')
const apply = args.includes('--apply')
const siteUrl = apply ? applicationUrl(process.env.RESTOCK_SITE_URL) : null
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' }) })
try {
  const records = await db.variantAvailability.findMany({ orderBy: { variantId: 'asc' } })
  if (!apply) console.log(`Modo consulta: ${records.length} SKU observados. No se modificó la cola ni se enviaron correos.`)
  else {
    let queued = 0
    for (const record of records) queued += await observeRestock(db, record.variantId, siteUrl)
    console.log(`Disponibilidad comprobada para ${records.length} SKU; ${queued} avisos añadidos a la cola. No se enviaron correos.`)
  }
} finally { await db.$disconnect() }
