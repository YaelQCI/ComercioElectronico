import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createCatalogRepository } from '../../server/features/catalog/catalog-repository.js'
import { parseCatalogFilters } from '../../shared/features/catalog/filters.js'
import { parseCatalogPage } from '../../shared/features/catalog/pagination.js'
import { supplementCategories } from '../../shared/features/catalog/supplement-categories.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base aislada fitness_migration_test*.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c timezone=UTC' }) })
test.after(() => db.$disconnect())
test('filtros incluyen categorías activas sin productos y excluyen las inactivas', async () => {
  const category = await db.category.create({ data: { name: 'Categoría vacía sintética', slug: `vacia-${randomUUID()}` } })
  const inactive = await db.category.create({ data: { name: 'Categoría inactiva sintética', slug: `inactiva-${randomUUID()}`, isActive: false } })
  const result = await createCatalogRepository(db).browse(parseCatalogFilters({ categoria: category.slug }), parseCatalogPage({}))
  for (const required of [...supplementCategories, category]) assert.ok(result.options.categoria.some(option => option.value === required.slug && option.label === required.name))
  assert.equal(result.options.categoria.some(option => option.value === inactive.slug), false)
  assert.equal(result.total, 0)
})
test('PostgreSQL encuentra nombre, SKU y categoría sin acentos; oculta borradores y no interpreta %', async () => {
  const token = randomUUID(), suffix = token.replaceAll('-', '')
  const product = await db.product.create({ data: { slug: `fixture-${token}`, name: `ProteÍna ${suffix} 50%_`, description: 'Fixture de búsqueda, no comercial', publishedAt: new Date() } })
  await db.productVariant.create({ data: { productId: product.id, sku: `FIX-${suffix}`, flavor: 'Neutro', flavorNormalized: 'neutro', presentationLabel: 'Fixture', presentationNormalized: 'fixture', contentAmount: '1', contentUnit: 'g', priceCents: 0n, weightGrams: 1, lengthMm: 1, widthMm: 1, heightMm: 1 } })
  const category = await db.category.create({ data: { slug: `fixture-cat-${token}`, name: `CategorÍa ${suffix}` } })
  await db.productCategory.create({ data: { productId: product.id, categoryId: category.id, isPrimary: true } })
  const repository = createCatalogRepository(db)
  for (const q of [`proteina ${suffix}`, `fix-${suffix}`, `categoria ${suffix}`]) assert.deepEqual((await repository.list({ q })).map(p => p.id), [product.id])
  assert.equal((await repository.list({ q: `%${suffix}` })).length, 0)
  assert.deepEqual((await repository.list({ q: `${suffix} 50%_` })).map(p => p.id), [product.id])
  await db.product.update({ where: { id: product.id }, data: { publishedAt: null } })
  assert.equal((await repository.list({ q: suffix })).length, 0)
})
