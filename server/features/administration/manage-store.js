import { randomUUID } from 'node:crypto'
import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { withInventoryTransaction } from '../inventory/inventory-transaction.js'
import { adjustInventory } from '../inventory/adjust-inventory.js'
const id = value => { if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value ?? '')) throw new AccountError(400, 'Identificador inválido.'); return value }
const cents = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(value)) throw new AccountError(400, 'Precio inválido; utiliza centavos como texto.'); return BigInt(value) }
function variantData(input) {
  const data = {}
  for (const key of ['sku', 'flavor', 'presentationLabel', 'contentUnit']) data[key] = accountText(input?.[key], key, 120)
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(data.sku)) throw new AccountError(400, 'SKU inválido.')
  data.flavorNormalized = data.flavor.toLowerCase(); data.presentationNormalized = data.presentationLabel.toLowerCase()
  if (typeof input.contentAmount !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(input.contentAmount) || Number(input.contentAmount) <= 0) throw new AccountError(400, 'Contenido inválido.')
  data.contentAmount = input.contentAmount; data.priceCents = cents(input.priceCents)
  for (const key of ['weightGrams', 'lengthMm', 'widthMm', 'heightMm']) { if (!Number.isInteger(input[key]) || input[key] < 1 || input[key] > 2147483647) throw new AccountError(400, 'Medidas inválidas.'); data[key] = input[key] }
  return data
}
async function audit(tx, actorId, entityType, entityId, action, reason, before, after) {
  await tx.auditEvent.create({ data: { actorId, actorType: 'ADMIN', entityType, entityId, action, reason, safeBefore: before, safeAfter: after, correlationId: randomUUID() } })
}
export function createStoreAdministration(db) {
  return {
    async createDraft(adminId, input) {
      const name = accountText(input?.name, 'Nombre'), description = accountText(input?.description, 'Descripción', 10000), slug = accountText(input?.slug, 'Slug', 150), reason = accountText(input?.reason, 'Motivo', 500)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Array.isArray(input?.variants) || !input.variants.length || input.variants.length > 100) throw new AccountError(400, 'Producto o variantes inválidos.')
      const variants = input.variants.map(variantData)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const saved = await tx.product.create({ data: { name, description, slug, productVariant_product: { create: variants } } })
        await audit(tx, adminId, 'Product', saved.id, 'CREATE_DRAFT_PRODUCT', reason, undefined, { name, slug })
        return { id: saved.id, published: false }
      })
    },
    async updateProduct(adminId, productId, input) {
      id(productId); const reason = accountText(input?.reason, 'Motivo', 500), data = {}
      for (const key of ['name', 'description', 'ingredients', 'allergenInformation', 'usageInstructions']) if (input[key] !== undefined) data[key] = accountText(input[key], key, key === 'name' ? 120 : 10000)
      if (input.deactivate === true) data.deletedAt = new Date()
      if (input.published !== undefined && typeof input.published !== 'boolean') throw new AccountError(400, 'Publicación inválida.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`
        const product = await tx.product.findUnique({ where: { id: productId } })
        if (!product) throw new AccountError(404, 'Producto no disponible.')
        if (input.published === true) {
          if (product.deletedAt || data.deletedAt) throw new AccountError(409, 'Un producto desactivado no se puede publicar.')
          const [variants, images] = await Promise.all([tx.productVariant.count({ where: { productId, deletedAt: null } }), tx.productMedia.count({ where: { productId, kind: 'FRONT' } })])
          if (!variants || !images) throw new AccountError(409, 'Antes de publicar configura variantes e imagen frontal documentada.')
          data.publishedAt = new Date()
        } else if (input.published === false) data.publishedAt = null
        if (input.categoryIds !== undefined) {
          if (!Array.isArray(input.categoryIds) || new Set(input.categoryIds).size !== input.categoryIds.length || input.categoryIds.length > 50) throw new AccountError(400, 'Categorías inválidas.')
          input.categoryIds.forEach(id)
          if (await tx.category.count({ where: { id: { in: input.categoryIds }, isActive: true } }) !== input.categoryIds.length) throw new AccountError(400, 'Categoría no disponible.')
          await tx.productCategory.deleteMany({ where: { productId } })
          for (const [position, categoryId] of input.categoryIds.entries()) await tx.productCategory.create({ data: { productId, categoryId, isPrimary: position === 0 } })
        }
        await tx.product.update({ where: { id: productId }, data })
        await audit(tx, adminId, 'Product', productId, 'UPDATE_PRODUCT', reason, { name: product.name, published: !!product.publishedAt, deactivated: !!product.deletedAt }, { name: data.name ?? product.name, published: input.published ?? !!product.publishedAt, deactivated: !!(data.deletedAt ?? product.deletedAt), categoryIds: input.categoryIds ?? null })
        return { id: productId }
      })
    },
    async updateVariant(adminId, variantId, input) {
      id(variantId); const reason = accountText(input?.reason, 'Motivo', 500)
      if (!Number.isInteger(input.expectedPriceVersion) || input.expectedPriceVersion < 1) throw new AccountError(400, 'Versión de precio inválida.')
      const data = {}
      if (input.priceCents !== undefined) data.priceCents = cents(input.priceCents)
      if (input.compareAtPriceCents !== undefined) data.compareAtPriceCents = input.compareAtPriceCents === null ? null : cents(input.compareAtPriceCents)
      if (input.deactivate === true) data.deletedAt = new Date()
      for (const key of ['weightGrams', 'lengthMm', 'widthMm', 'heightMm']) if (input[key] !== undefined) { if (!Number.isInteger(input[key]) || input[key] < 1 || input[key] > 2147483647) throw new AccountError(400, 'Medidas inválidas.'); data[key] = input[key] }
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId}::uuid FOR UPDATE`
        const current = await tx.productVariant.findUnique({ where: { id: variantId } })
        if (!current) throw new AccountError(404, 'Variante no disponible.')
        if (current.priceVersion !== input.expectedPriceVersion) throw new AccountError(409, 'La variante cambió. Consulta su versión.')
        const price = data.priceCents ?? current.priceCents, previous = data.compareAtPriceCents !== undefined ? data.compareAtPriceCents : current.compareAtPriceCents
        if (previous !== null && previous <= price) throw new AccountError(400, 'Precio anterior debe superar el vigente.')
        await tx.productVariant.update({ where: { id: variantId }, data: { ...data, priceVersion: { increment: 1 } } })
        await audit(tx, adminId, 'ProductVariant', variantId, 'UPDATE_VARIANT', reason, { priceCents: current.priceCents.toString(), version: current.priceVersion }, { priceCents: price.toString(), version: current.priceVersion+1, deactivated: !!(data.deletedAt ?? current.deletedAt) })
        return { id: variantId, priceVersion: current.priceVersion+1 }
      })
    },
    async adjustStock(adminId, input) {
      id(input?.lotId); accountText(input?.reason, 'Motivo', 500); accountText(input?.idempotencyKey, 'Clave', 150)
      return withInventoryTransaction(db, async context => {
        await requireAdministrator(context.tx, adminId)
        const movement = await adjustInventory(context, { ...input, actorId: adminId })
        return { movementId: movement.id, lotId: movement.lotId, delta: movement.onHandDelta }
      })
    },
    async users(adminId, page = 1) {
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new AccountError(400, 'Página inválida.')
      return db.$transaction(async tx => { await requireAdministrator(tx, adminId); return tx.user.findMany({ skip: (page-1)*20, take: 20, orderBy: { id: 'asc' }, select: { id: true, email: true, displayName: true, role: true, deletedAt: true } }) })
    },
    async deactivateUser(adminId, userId, input) {
      id(userId); const reason = accountText(input?.reason, 'Motivo', 500)
      if (adminId === userId) throw new AccountError(409, 'Usa el flujo personal para desactivar tu propia cuenta.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) throw new AccountError(404, 'Cuenta no disponible.')
        if (user.role === 'ADMIN') throw new AccountError(409, 'La desactivación de administradores requiere el procedimiento restringido del propietario.')
        if (!user.deletedAt) {
          await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date(), authVersion: { increment: 1 } } })
          await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: 'Desactivación administrativa' } })
          await audit(tx, adminId, 'User', userId, 'DEACTIVATE_USER', reason, { deactivated: false }, { deactivated: true })
        }
        return { id: userId, deactivated: true }
      })
    },
  }
}
