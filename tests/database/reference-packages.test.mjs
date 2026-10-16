import test from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFile } from 'node:fs/promises'
import { ensureReferencePackages } from '../../server/features/shipping/reference-packages.js'
import { referencePackages } from '../../shared/features/shipping/reference-packages.js'
import { packageConfiguration } from '../../shared/features/shipping/package-configuration.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
test('migración registra las tres cajas y el inicio conserva cambios y restaura faltantes', async () => {
  for (const box of referencePackages) {
    const saved = await db.packageType.findUniqueOrThrow({ where: { code: box.code } })
    assert.deepEqual(packageConfiguration(saved), box)
  }
  const first = await db.packageType.findUniqueOrThrow({ where: { code: 'CAJA-CHICA' } })
  await db.packageType.update({ where: { id: first.id }, data: { isActive: false, tareWeightGrams: 180, version: 2 } })
  await db.packageType.delete({ where: { code: 'CAJA-GRANDE' } })
  await ensureReferencePackages(db)
  await ensureReferencePackages(db)
  const changed = await db.packageType.findUniqueOrThrow({ where: { id: first.id } })
  assert.equal(changed.isActive, false); assert.equal(changed.tareWeightGrams, 180); assert.equal(changed.version, 2)
  assert.equal(await db.packageType.count({ where: { code: { in: referencePackages.map(box => box.code) } } }), 3)
  const sql = await readFile(new URL('../../prisma/migrations/20261016020000_reference_shipping_packages/migration.sql', import.meta.url), 'utf8')
  // Reejecución del INSERT para comprobar idempotencia sin tocar el historial Prisma.
  await db.$executeRawUnsafe(sql.replace(/^BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, ''))
  assert.equal((await db.packageType.findUniqueOrThrow({ where: { id: first.id } })).tareWeightGrams, 180)
  await db.packageType.update({ where: { id: first.id }, data: { isActive: true, tareWeightGrams: 150, version: 1 } })
})
