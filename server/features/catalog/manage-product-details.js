import { randomUUID } from 'node:crypto'
import { Prisma } from '../../../generated/prisma/client.ts'
import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { optionalProductText, nutritionData } from '../../../shared/features/catalog/product-details.js'
import { parseServings } from '../../../shared/features/catalog/servings.js'
import { variantData } from './variant-input.js'

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
export function variantDetails(input) {
  const data = {}
  try {
    if ('servingAmount' in input || 'servingUnit' in input) {
      data.servingAmount = parseServings(input.servingAmount)
      data.servingUnit = optionalProductText(input.servingUnit, 'Unidad de porción', 30)
      if ((data.servingAmount == null) !== (data.servingUnit == null) || /[\n\t]/.test(data.servingUnit ?? '')) throw new RangeError('Indica juntos el tamaño y la unidad de porción, o deja ambos vacíos.')
    }
    if ('nutritionData' in input) data.nutritionData = nutritionData(input.nutritionData) ?? Prisma.DbNull
  } catch (error) { throw new AccountError(400, error.message) }
  return data
}
export async function assignProductDetails(tx, productId, input, adminId) {
  const fields = ['ingredients', 'usageInstructions', 'allergenInformation', 'brandId', 'relatedProductIds', 'crossSellProductIds']
  if (!fields.some(key => key in input)) return
  const before = await tx.product.findUnique({ where: { id: productId }, select: { ingredients: true, usageInstructions: true, allergenInformation: true, brandId: true } })
  const previousRelations = await tx.productRelation.findMany({ where: { sourceProductId: productId }, orderBy: [{ kind: 'asc' }, { position: 'asc' }, { targetProductId: 'asc' }], select: { targetProductId: true, kind: true, position: true } })
  const data = {}
  try { for (const [key, label] of [['ingredients', 'Ingredientes'], ['usageInstructions', 'Modo de uso'], ['allergenInformation', 'Alérgenos']]) if (key in input) data[key] = optionalProductText(input[key], label) } catch (error) { throw new AccountError(400, error.message) }
  if ('brandId' in input) {
    if (input.brandId !== null && (!uuid(input.brandId) || !await tx.brand.findFirst({ where: { id: input.brandId, isActive: true } }))) throw new AccountError(400, 'Marca no disponible.')
    data.brandId = input.brandId
  }
  if (Object.keys(data).length) await tx.product.update({ where: { id: productId }, data })
  for (const [key, kind] of [['relatedProductIds', 'RELATED'], ['crossSellProductIds', 'CROSS_SELL']]) {
    if (!(key in input)) continue
    const ids = input[key]
    if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length || ids.some(id => !uuid(id) || id === productId)) throw new AccountError(400, 'Selecciona hasta ocho productos distintos por grupo de recomendaciones; no incluyas el producto actual.')
    if (await tx.product.count({ where: { id: { in: ids }, deletedAt: null } }) !== ids.length) throw new AccountError(400, 'Algún producto recomendado no está disponible.')
    await tx.productRelation.deleteMany({ where: { sourceProductId: productId, kind } })
    if (ids.length) await tx.productRelation.createMany({ data: ids.map((targetProductId, position) => ({ sourceProductId: productId, targetProductId, kind, position })) })
  }
  await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', entityType: 'Product', entityId: productId, action: 'UPDATE_PRODUCT_DETAILS', reason: accountText(input.reason, 'Motivo', 500), safeBefore: { ...before, recommendations: previousRelations }, safeAfter: { ...before, ...data, ...(input.relatedProductIds === undefined ? {} : { relatedProductIds: input.relatedProductIds }), ...(input.crossSellProductIds === undefined ? {} : { crossSellProductIds: input.crossSellProductIds }) }, correlationId: randomUUID() } })
}
export function createProductDetailsAdministration(db) {
  return {
    async options(adminId, q = '') {
      if (typeof q !== 'string' || q.length > 120) throw new AccountError(400, 'Búsqueda inválida; máximo 120 caracteres.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const brands = await tx.brand.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true }, take: 1000 })
        const products = await tx.product.findMany({ where: { deletedAt: null, ...(q.trim() ? { OR: [{ name: { contains: q.trim(), mode: 'insensitive' } }, { productVariant_product: { some: { sku: { contains: q.trim(), mode: 'insensitive' } } } }] } : {}) }, select: { id: true, name: true, publishedAt: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 21 })
        return { brands, products: products.slice(0, 20).map(product => ({ id: product.id, name: product.name, published: !!product.publishedAt })), hasMore: products.length > 20 }
      })
    },
    async createBrand(adminId, input) {
      const name = accountText(input?.name, 'Nombre de marca', 120), slug = accountText(input?.slug, 'Identificador de marca', 150), reason = accountText(input?.reason, 'Motivo', 500)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AccountError(400, 'Identificador de marca inválido.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const key = `brand:${name.toLowerCase()}`
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`
        if (await tx.brand.findFirst({ where: { OR: [{ slug }, { name: { equals: name, mode: 'insensitive' } }] } })) throw new AccountError(409, 'Ya existe esa marca o identificador.')
        const brand = await tx.brand.create({ data: { name, slug } })
        await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', entityType: 'Brand', entityId: brand.id, action: 'CREATE_BRAND', reason, safeAfter: { name, slug }, correlationId: randomUUID() } })
        return { id: brand.id, name, slug }
      })
    },
    async createVariant(adminId, productId, input) {
      if (!uuid(productId)) throw new AccountError(400, 'Producto inválido.')
      const reason = accountText(input?.reason, 'Motivo', 500), values = { ...variantData(input ?? {}), ...variantDetails(input ?? {}) }
      if (input.compareAtPriceCents != null && (typeof input.compareAtPriceCents !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(input.compareAtPriceCents) || BigInt(input.compareAtPriceCents) <= values.priceCents)) throw new AccountError(400, 'El precio anterior debe superar el precio vigente.')
      if (input.compareAtPriceCents != null) values.compareAtPriceCents = BigInt(input.compareAtPriceCents)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId}::uuid FOR UPDATE`
        const product = await tx.product.findUnique({ where: { id: productId } })
        if (!product || product.deletedAt) throw new AccountError(404, 'Producto no disponible.')
        if (input.expectedUpdatedAt !== product.updatedAt.toISOString()) throw new AccountError(409, 'El producto cambió. Actualiza antes de agregar una presentación.')
        if (await tx.productVariant.count({ where: { productId } }) >= 100) throw new AccountError(409, 'Máximo 100 presentaciones por producto.')
        const variant = await tx.productVariant.create({ data: { ...values, productId } })
        await tx.product.update({ where: { id: productId }, data: { updatedAt: new Date() } })
        await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', entityType: 'ProductVariant', entityId: variant.id, action: 'CREATE_VARIANT', reason, safeAfter: { productId, sku: variant.sku, flavor: variant.flavor, presentationLabel: variant.presentationLabel, priceCents: variant.priceCents.toString() }, correlationId: randomUUID() } })
        return { id: variant.id }
      })
    },
  }
}
