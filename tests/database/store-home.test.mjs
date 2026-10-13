import test from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
test.after(() => db.$disconnect())
test('inicio devuelve selección explícita, máximo ocho, conteos persistentes y sin borradores', async () => {
  const home = await createCatalogRepository(db).home()
  const where = { deletedAt: null, publishedAt: { lte: new Date() }, productVariant_product: { some: { deletedAt: null } }, OR: [{ brandId: null }, { brand: { isActive: true } }] }
  const expected = await db.product.findMany({ where: { ...where, featuredPosition: { not: null } }, orderBy: [{ featuredPosition: 'asc' }, { id: 'asc' }], take: 8, select: { id: true } })
  assert.deepEqual(home.featured.map(p => p.id), expected.map(p => p.id))
  for (const category of home.categories) {
    const count = await db.productCategory.count({ where: { category: { slug: category.slug }, product: where } })
    assert.equal(category.productCount, count)
  }
})
