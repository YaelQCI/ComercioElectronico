import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { supplementCategories } from '../../shared/features/catalog/supplement-categories.js'
import { ensureSupplementCategories } from '../../server/features/catalog/supplement-categories.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Base aislada requerida.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
test.after(() => db.$disconnect())
const slugs = supplementCategories.map(category => category.slug)

test('migración registra las siete categorías y el inicio recupera faltantes sin duplicar ni perder vínculos', async () => {
  const existing = await db.category.findMany({ where: { slug: { in: slugs } } })
  assert.equal(existing.length, 7)
  for (const category of supplementCategories) {
    const saved = existing.find(item => item.slug === category.slug)
    assert.equal(saved.name, category.name); assert.equal(saved.isActive, true)
  }
  const rollback = new Error('Revertir exclusivamente los cambios sintéticos de esta prueba')
  await assert.rejects(db.$transaction(async tx => {
    const protein = existing.find(category => category.slug === 'proteina')
    const product = await tx.product.create({ data: { name: 'Vínculo sintético', slug: randomUUID(), description: 'Solo pruebas' } })
    await tx.productCategory.create({ data: { productId: product.id, categoryId: protein.id } })
    await tx.category.update({ where: { id: protein.id }, data: { name: 'Nombre alterado de prueba', isActive: false } })
    // Libera el slug dentro de la transacción sin borrar vínculos del catálogo inicial.
    const creatine = existing.find(category => category.slug === 'creatina')
    const linkedCreatine = await tx.productCategory.count({ where: { categoryId: creatine.id } })
    await tx.category.update({ where: { id: creatine.id }, data: { slug: `temporal-${randomUUID()}` } })
    const custom = await tx.category.create({ data: { slug: randomUUID(), name: 'Otra categoría sintética' } })
    const scoped = { $transaction: callback => callback(tx) }
    await ensureSupplementCategories(scoped)
    const first = await tx.category.findMany({ where: { slug: { in: slugs } }, orderBy: { slug: 'asc' } })
    await ensureSupplementCategories(scoped)
    const second = await tx.category.findMany({ where: { slug: { in: slugs } }, orderBy: { slug: 'asc' } })
    assert.equal(second.length, 7)
    assert.deepEqual(second.map(c => c.id), first.map(c => c.id))
    assert.equal(second.find(c => c.slug === 'proteina').id, protein.id)
    for (const expected of supplementCategories) {
      const saved = second.find(c => c.slug === expected.slug)
      assert.equal(saved.name, expected.name); assert.equal(saved.isActive, true)
    }
    assert.equal(await tx.productCategory.count({ where: { productId: product.id, categoryId: protein.id } }), 1)
    assert.equal(await tx.productCategory.count({ where: { categoryId: creatine.id } }), linkedCreatine)
    assert.equal((await tx.category.findUnique({ where: { id: custom.id } })).name, custom.name)
    // El SQL versionado también debe poder ejecutarse de nuevo sin duplicar ni modificar IDs.
    const sql = (await readFile(new URL('../../prisma/migrations/20261016010000_required_supplement_categories/migration.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '')
    await tx.$executeRawUnsafe(sql)
    assert.deepEqual((await tx.category.findMany({ where: { slug: { in: slugs } }, orderBy: { slug: 'asc' } })).map(c => c.id), second.map(c => c.id))
    throw rollback
  }, { timeout: 30000 }), error => error === rollback)
})
