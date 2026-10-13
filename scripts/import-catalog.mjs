import 'dotenv/config'
import { readFile, realpath } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { validateCatalogManifest } from '../server/features/catalog/catalog-manifest.js'
import { importCatalog } from '../server/features/catalog/import-catalog.js'

const args = process.argv.slice(2)
if (args.length < 1 || args.length > 2 || (args[1] && args[1] !== '--apply')) throw new Error('Uso: npm run catalog:import -- archivo.json [--apply]. Sin --apply solo valida.')
const manifest = validateCatalogManifest(JSON.parse(await readFile(resolve(args[0]), 'utf8')))
const publicRoot = await realpath(resolve('public'))
async function resolveAsset(path) {
  const target = await realpath(resolve(publicRoot, path.slice(1)))
  if (!target.startsWith(`${publicRoot}${sep}`)) throw new Error('Archivo fuera del directorio public.')
  const bytes = await readFile(target)
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('El recurso debe medir entre 1 byte y 20 MB.')
  const mimeType = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' }[extname(target).toLowerCase()]
  const signatures = { 'image/webp': bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP', 'image/png': bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, 'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-' }
  if (!signatures[mimeType]) throw new Error('El contenido del recurso no coincide con su extensión.')
  return { mimeType, byteSize: String(bytes.length), checksum: createHash('sha256').update(bytes).digest('hex') }
}
for (const product of manifest.products) {
  for (const asset of [...product.images, ...product.variants.flatMap(v => v.lots.map(l => l.certificate).filter(Boolean))]) await resolveAsset(asset.path)
}
if (args[1] !== '--apply') {
  console.log(`Manifiesto y archivos válidos: ${manifest.products.length} productos. No se escribió en la base de datos.`)
} else {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.')
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  try { console.log(JSON.stringify(await importCatalog(db, manifest, { resolveAsset }))) } finally { await db.$disconnect() }
}
