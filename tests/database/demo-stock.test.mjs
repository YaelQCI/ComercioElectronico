import test from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { initializeDemoStock } from '../../server/features/inventory/initialize-demo-stock.js'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())

test('28 lotes DEMO con cantidades variadas, ledger y disponibilidad pública; reejecutar no repone ni duplica', async () => {
  const movements = await db.inventoryMovement.findMany({ where: { idempotencyKey: { startsWith: 'demo-catalog-stock-v1:' } }, include: { lot: { include: { variant: true } } } })
  assert.equal(movements.length, 28)
  const quantities = movements.map(movement => movement.onHandDelta)
  assert.equal(Math.min(...quantities), 2); assert.equal(Math.max(...quantities), 60)
  assert.ok(new Set(quantities).size > 10)
  for (const movement of movements) {
    assert.equal(movement.kind, 'RECEIPT'); assert.equal(movement.actorType, 'SYSTEM'); assert.equal(movement.actorId, null)
    assert.equal(movement.lot.onHandQty, movement.onHandDelta); assert.equal(movement.lot.reservedQty, 0)
    assert.equal(movement.lot.lotCode, 'DEMO-INICIAL-01'); assert.equal(movement.lot.certificateAssetId, null)
    assert.equal(movement.lot.expiresOn, null); assert.equal(movement.lot.importedOn, null)
    const visible = await createCatalogRepository(db).getById(movement.lot.variant.productId)
    assert.equal(visible.variants[0].availableQty, movement.onHandDelta)
  }
  assert.equal(await initializeDemoStock(db), 0)
  const rollback = Error('Revertir el ajuste sintético de la prueba')
  await assert.rejects(db.$transaction(async tx => {
    const first = movements[0]
    await tx.inventoryMovement.create({ data: { lotId: first.lotId, kind: 'WASTE', onHandDelta: -first.onHandDelta, reason: 'Prueba sintética de agotamiento', actorType: 'SYSTEM', idempotencyKey: 'demo-stock-test:' + first.lotId } })
    assert.equal(await initializeDemoStock(tx), 0)
    assert.equal((await tx.inventoryLot.findUniqueOrThrow({ where: { id: first.lotId } })).onHandQty, 0)
    assert.equal(await tx.inventoryMovement.count({ where: { idempotencyKey: { startsWith: 'demo-catalog-stock-v1:' } } }), 28)
    throw rollback
  }), error => error === rollback)
  assert.equal(await db.auditEvent.count({ where: { action: 'INITIALIZE_DEMO_STOCK' } }), 28)
})

test('sin almacén la inicialización se difiere sin inventar una dirección', async () => {
  const rollback = Error('Revertir cambios sintéticos')
  await assert.rejects(db.$transaction(async tx => {
    // Una tabla temporal vacía oculta el almacén únicamente para esta conexión.
    // Los datos y vínculos reales de la base aislada permanecen intactos.
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "Warehouse" (LIKE public."Warehouse" INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP')
    assert.equal(await initializeDemoStock(tx), 0)
    await tx.$executeRawUnsafe('DROP TABLE pg_temp."Warehouse"')
    assert.equal(await initializeDemoStock(tx), 0)
    throw rollback
  }), error => error === rollback)
})
