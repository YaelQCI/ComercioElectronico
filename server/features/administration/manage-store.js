import { randomUUID } from 'node:crypto'
import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { withInventoryTransaction } from '../inventory/inventory-transaction.js'
import { adjustInventory } from '../inventory/adjust-inventory.js'
import { isMexicanStateCode } from '../../../shared/features/shipping/mexican-states.js'
import { publicImage } from '../catalog/catalog-repository.js'
import { searchQuery, searchPattern } from '../../../shared/features/catalog/search.js'
import { variantData } from '../catalog/variant-input.js'
import { variantDetails, assignProductDetails } from '../catalog/manage-product-details.js'
import { lotTraceability } from '../../../shared/features/inventory/lot-traceability.js'
import { initializeDemoStock } from '../inventory/initialize-demo-stock.js'
import { initializeDemoHistory } from '../orders/initialize-demo-history.js'
import { featuredPosition } from '../catalog/featured-selection.js'
const id = value => { if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value ?? '')) throw new AccountError(400, 'Identificador inválido.'); return value }
const cents = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(value)) throw new AccountError(400, 'Precio inválido; utiliza centavos como texto.'); return BigInt(value) }
function warehouseData(input) {
  const data = {}
  for (const key of ['name', 'recipientName', 'postalCode', 'state', 'city', 'district', 'street', 'exteriorNumber', 'contactName']) data[key] = accountText(input?.[key], key, 120)
  data.phone = accountText(input?.phone, 'Teléfono', 25)
  for (const key of ['interiorNumber', 'references']) data[key] = input?.[key] == null || input[key] === '' ? null : accountText(input[key], key, key === 'references' ? 500 : 120)
  if (!/^\d{5}$/.test(data.postalCode)) throw new AccountError(400, 'El código postal debe contener cinco dígitos.')
  if (!isMexicanStateCode(data.state)) throw new AccountError(400, 'Selecciona un estado de México válido.')
  return data
}

async function audit(tx, actorId, entityType, entityId, action, reason, before, after) {
  await tx.auditEvent.create({ data: { actorId, actorType: 'ADMIN', entityType, entityId, action, reason, safeBefore: before, safeAfter: after, correlationId: randomUUID() } })
}
async function changeVariant(tx, adminId, variantId, input, productId) {
  id(variantId)
  const reason = accountText(input?.reason, 'Motivo', 500)
  if (!Number.isInteger(input.expectedPriceVersion) || input.expectedPriceVersion < 1) throw new AccountError(400, 'Versión de variante inválida.')
  await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId}::uuid FOR UPDATE`
  const current = await tx.productVariant.findUnique({ where: { id: variantId } })
  if (!current || (productId && current.productId !== productId)) throw new AccountError(404, 'Variante no disponible en este producto.')
  const product = await tx.product.findUnique({ where: { id: current.productId } })
  if (!product || product.deletedAt) throw new AccountError(409, 'El producto está desactivado.')
  if (current.priceVersion !== input.expectedPriceVersion) throw new AccountError(409, 'La variante cambió. Actualiza la información antes de guardar.')
  if (current.deletedAt) throw new AccountError(409, 'Una variante desactivada no se puede modificar.')
  const merged = { ...current, contentAmount: current.contentAmount.toString(), priceCents: current.priceCents.toString(), servings: current.servings?.toString() ?? null, ...input }
  const data = { ...variantData(merged), ...variantDetails(input) }
  if (input.compareAtPriceCents !== undefined) data.compareAtPriceCents = input.compareAtPriceCents === null ? null : cents(input.compareAtPriceCents)
  if (input.deactivate === true) data.deletedAt = new Date()
  const previous = data.compareAtPriceCents !== undefined ? data.compareAtPriceCents : current.compareAtPriceCents
  if (previous !== null && previous <= data.priceCents) throw new AccountError(400, 'Precio anterior debe superar el vigente.')
  await tx.productVariant.update({ where: { id: variantId }, data: { ...data, priceVersion: { increment: 1 } } })
  await audit(tx, adminId, 'ProductVariant', variantId, 'UPDATE_VARIANT', reason, { sku: current.sku, priceCents: current.priceCents.toString(), servings: current.servings?.toString() ?? null, version: current.priceVersion, servingAmount: current.servingAmount?.toString() ?? null, servingUnit: current.servingUnit, nutritionData: current.nutritionData }, { details: { servingAmount: input.servingAmount === undefined ? current.servingAmount?.toString() ?? null : input.servingAmount, servingUnit: input.servingUnit === undefined ? current.servingUnit : input.servingUnit, nutritionData: input.nutritionData === undefined ? current.nutritionData : input.nutritionData }, sku: data.sku, flavor: data.flavor, presentationLabel: data.presentationLabel, contentAmount: data.contentAmount, contentUnit: data.contentUnit, servings: data.servings, priceCents: data.priceCents.toString(), weightGrams: data.weightGrams, lengthMm: data.lengthMm, widthMm: data.widthMm, heightMm: data.heightMm, version: current.priceVersion+1, deactivated: !!data.deletedAt })
  return { id: variantId, priceVersion: current.priceVersion+1 }
}
async function assignCategories(tx, productId, categoryIds) {
  if (!Array.isArray(categoryIds) || new Set(categoryIds).size !== categoryIds.length || categoryIds.length > 50) throw new AccountError(400, 'Categorías inválidas.')
  categoryIds.forEach(id)
  if (await tx.category.count({ where: { id: { in: categoryIds }, isActive: true } }) !== categoryIds.length) throw new AccountError(400, 'Categoría no disponible.')
  await tx.productCategory.deleteMany({ where: { productId } })
  for (const [position, categoryId] of categoryIds.entries()) await tx.productCategory.create({ data: { productId, categoryId, isPrimary: position === 0 } })
}
export function createStoreAdministration(db) {
  return {
    async searchLotVariants(adminId, query) {
      let q
      try { q = searchQuery(query) } catch { throw new AccountError(400, 'Busca con un máximo de 120 caracteres.') }
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        if (q.length < 2) return { variants: [], hasMore: false }
        const pattern = searchPattern(q), escape = '\\'
        const marks = Array.from({ length: 112 }, (_, i) => String.fromCharCode(0x300 + i)).join('')
        const variants = await tx.$queryRaw`
          SELECT v.id, v.sku, v.flavor, v."presentationLabel", p.name AS "productName"
          FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
          WHERE v."deletedAt" IS NULL AND p."deletedAt" IS NULL
            AND (translate(lower(normalize(p.name, NFKD)), ${marks}, '') LIKE ${pattern} ESCAPE ${escape}
              OR translate(lower(normalize(v.sku, NFKD)), ${marks}, '') LIKE ${pattern} ESCAPE ${escape})
          ORDER BY p.name, v.sku, v.id LIMIT 21
        `
        return { variants: variants.slice(0, 20), hasMore: variants.length > 20 }
      })
    },
    async categories(adminId) {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        return tx.category.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true } })
      })
    },
    async createCategory(adminId, input) {
      const name = accountText(input?.name, 'Nombre de categoría', 120), slug = accountText(input?.slug, 'Identificador de categoría', 150), reason = accountText(input?.reason, 'Motivo', 500)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AccountError(400, 'Identificador de categoría inválido.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const key = `catalog-category:${name.toLowerCase()}`
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`
        if (await tx.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })) throw new AccountError(409, 'Ya existe una categoría con ese nombre.')
        const saved = await tx.category.create({ data: { name, slug } })
        await audit(tx, adminId, 'Category', saved.id, 'CREATE_CATEGORY', reason, undefined, { name, slug })
        return { id: saved.id, name: saved.name, slug: saved.slug }
      })
    },
    async checkDraftIdentifiers(adminId, input) {
      const slug = input?.slug === undefined ? '' : input.slug, sku = input?.sku === undefined ? '' : input.sku
      if (typeof slug !== 'string' || typeof sku !== 'string' || slug.length > 150 || sku.length > 120) throw new AccountError(400, 'Identificadores inválidos.')
      const normalizedSlug = slug.trim(), normalizedSku = sku.trim()
      if ((normalizedSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) || (normalizedSku && !/^[A-Z0-9][A-Z0-9._-]*$/.test(normalizedSku))) throw new AccountError(400, 'Formato de slug o SKU inválido.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const product = normalizedSlug ? await tx.product.findUnique({ where: { slug: normalizedSlug }, select: { id: true } }) : null
        const variant = normalizedSku ? await tx.productVariant.findUnique({ where: { sku: normalizedSku }, select: { id: true } }) : null
        return { slugExists: !!product, skuExists: !!variant }
      })
    },
    async overview(adminId, section, page = 1) {
      if (!['products', 'inventory'].includes(section) || !Number.isSafeInteger(page) || page < 1 || page > 100000) throw new AccountError(400, 'Consulta inválida.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        if (section === 'products') {
          const total = await tx.product.count()
          const products = await tx.product.findMany({ skip: (page-1)*20, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { brand: true, productRelation_sourceProduct: { include: { targetProduct: { select: { id: true, name: true, deletedAt: true } } }, orderBy: [{ position: 'asc' }, { targetProductId: 'asc' }] }, productVariant_product: { orderBy: { sku: 'asc' } }, productMedia_product: { include: { asset: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }] }, productCategory_product: { include: { category: true }, orderBy: [{ isPrimary: 'desc' }, { categoryId: 'asc' }] } } })
          const creationEvents = await tx.auditEvent.findMany({ where: { action: 'CREATE_DRAFT_PRODUCT', entityType: 'Product', entityId: { in: products.map(product => product.id) } }, select: { entityId: true, reason: true } })
          return { total, page, pages: Math.ceil(total/20), products: products.map(p => ({ id: p.id, name: p.name, slug: p.slug, description: p.description, ingredients: p.ingredients, usageInstructions: p.usageInstructions, allergenInformation: p.allergenInformation, brandId: p.brandId, brand: p.brand ? { id: p.brand.id, name: p.brand.name, isActive: p.brand.isActive } : null, recommendations: p.productRelation_sourceProduct.map(link => ({ id: link.targetProductId, name: link.targetProduct.name, kind: link.kind, deactivated: !!link.targetProduct.deletedAt })), featuredPosition: p.featuredPosition, updatedAt: p.updatedAt.toISOString(), creationReason: creationEvents.find(event => event.entityId === p.id)?.reason ?? null, categories: p.productCategory_product.map(link => ({ id: link.categoryId, name: link.category.name, isPrimary: link.isPrimary, isActive: link.category.isActive })), published: !!p.publishedAt, deactivated: !!p.deletedAt, images: p.productMedia_product.map(publicImage).filter(Boolean), variants: p.productVariant_product.map(v => ({ id: v.id, sku: v.sku, flavor: v.flavor, presentationLabel: v.presentationLabel, contentAmount: v.contentAmount.toString(), contentUnit: v.contentUnit, servings: v.servings?.toString() ?? null, servingAmount: v.servingAmount?.toString() ?? null, servingUnit: v.servingUnit, nutritionData: v.nutritionData, weightGrams: v.weightGrams, lengthMm: v.lengthMm, widthMm: v.widthMm, heightMm: v.heightMm, priceCents: v.priceCents.toString(), compareAtPriceCents: v.compareAtPriceCents?.toString() ?? null, priceVersion: v.priceVersion, deactivated: !!v.deletedAt })) })) }
        }
        const total = await tx.inventoryLot.count()
        const lots = await tx.inventoryLot.findMany({ skip: (page-1)*20, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { variant: { select: { sku: true, productId: true, product: { select: { name: true } } } }, warehouse: { select: { name: true } } } })
        const warehouses = await tx.warehouse.findMany({ select: { id: true, name: true, recipientName: true, contactName: true, phone: true, countryCode: true, postalCode: true, state: true, city: true, district: true, street: true, exteriorNumber: true, interiorNumber: true, references: true, timezone: true, configurationVersion: true, updatedAt: true } })
        return { total, page, pages: Math.ceil(total/20), warehouses, lots: lots.map(l => ({ id: l.id, sku: l.variant.sku, productId: l.variant.productId, variantId: l.variantId, productName: l.variant.product.name, warehouse: l.warehouse.name, lotCode: l.lotCode, version: l.version, importedOn: l.importedOn?.toISOString().slice(0,10) ?? null, origin: l.origin, customsEntry: l.customsEntry, certificateUrl: l.certificateAssetId ? `/api/catalog/lots/${l.id}/certificate` : null, expiresOn: l.expiresOn?.toISOString().slice(0,10) ?? null, onHandQty: l.onHandQty, reservedQty: l.reservedQty, nonSellableQty: l.nonSellableQty, isBlocked: l.isBlocked })) }
      }, { isolationLevel: 'RepeatableRead' })
    },
    async createLot(adminId, input) {
      const sku = accountText(input?.sku, 'SKU', 120), warehouseId = id(input?.warehouseId), lotCode = accountText(input?.lotCode, 'Lote', 120), reason = accountText(input?.reason, 'Motivo', 500)
      const initialQuantity = input.initialQuantity === undefined ? 0 : input.initialQuantity
      if (!Number.isInteger(initialQuantity) || initialQuantity < 0 || initialQuantity > 2147483647) throw new AccountError(400, 'La cantidad inicial debe ser un número entero de piezas entre 0 y 2147483647.')
      const expiresOn = input.expiresOn ? new Date(`${input.expiresOn}T00:00:00.000Z`) : null
      if (expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn) || !Number.isFinite(expiresOn.getTime()) || expiresOn.toISOString().slice(0,10) !== input.expiresOn)) throw new AccountError(400, 'Caducidad inválida.')
      return withInventoryTransaction(db, async context => {
        const tx = context.tx
        await requireAdministrator(tx, adminId)
        const variant = await tx.productVariant.findFirst({ where: { sku, deletedAt: null, product: { deletedAt: null } } })
        if (!variant || !await tx.warehouse.findUnique({ where: { id: warehouseId } })) throw new AccountError(400, 'Variante o almacén no disponible.')
        const variantId = variant.id
        let trace
        try { trace = lotTraceability(input) } catch (error) { throw new AccountError(400, error.message) }
        const lot = await tx.inventoryLot.create({ data: { variantId, warehouseId, lotCode, expiresOn, expiryPrecision: expiresOn ? 'DAY' : null, ...trace, importedOn: trace.importedOn ? new Date(trace.importedOn+'T00:00:00Z') : null } })
        if (initialQuantity > 0) await adjustInventory(context, { lotId: lot.id, delta: initialQuantity, reason, actorId: adminId, idempotencyKey: `lot-initial:${lot.id}` })
        await audit(tx, adminId, 'InventoryLot', lot.id, 'CREATE_LOT', reason, undefined, { lotCode, variantId, warehouseId, initialQuantity, origin: lot.origin, customsEntry: lot.customsEntry, importedOn: lot.importedOn })
        return { id: lot.id }
      })
    },
    async configureWarehouse(adminId, input) {
      const data = warehouseData(input), reason = accountText(input?.reason, 'Motivo', 500)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const current = await tx.warehouse.findUnique({ where: { singletonKey: 1 } })
        if (current) throw new AccountError(409, 'El almacén ya está configurado; su modificación requiere revisar las cotizaciones existentes.')
        const saved = await tx.warehouse.create({ data })
        await initializeDemoStock(tx)
        await initializeDemoHistory(tx)
        await audit(tx, adminId, 'Warehouse', saved.id, 'CONFIGURE_WAREHOUSE', reason, undefined, { name: saved.name })
        return { id: saved.id }
      })
    },
    async updateWarehouse(adminId, input) {
      const data = warehouseData(input), reason = accountText(input?.reason, 'Motivo', 500)
      if (!Number.isInteger(input.expectedConfigurationVersion) || input.expectedConfigurationVersion < 1 || input.expectedConfigurationVersion >= 2147483647) throw new AccountError(400, 'Versión del almacén inválida.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Warehouse" WHERE "singletonKey" = 1 FOR UPDATE`
        const current = await tx.warehouse.findUnique({ where: { singletonKey: 1 } })
        if (!current) throw new AccountError(404, 'Almacén no configurado.')
        if (current.configurationVersion !== input.expectedConfigurationVersion) throw new AccountError(409, 'El almacén cambió. Actualiza la información antes de editar de nuevo.')
        const saved = await tx.warehouse.update({ where: { id: current.id }, data: { ...data, configurationVersion: { increment: 1 } } })
        await audit(tx, adminId, 'Warehouse', saved.id, 'UPDATE_WAREHOUSE', reason, { version: current.configurationVersion }, { version: saved.configurationVersion, changedFields: Object.keys(data).filter(key => data[key] !== current[key]) })
        return { id: saved.id, configurationVersion: saved.configurationVersion }
      })
    },
    async createDraft(adminId, input) {
      const name = accountText(input?.name, 'Nombre'), description = accountText(input?.description, 'Descripción', 10000), slug = accountText(input?.slug, 'Slug', 150), reason = accountText(input?.reason, 'Motivo', 500)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Array.isArray(input?.variants) || !input.variants.length || input.variants.length > 100) throw new AccountError(400, 'Producto o variantes inválidos.')
      const variants = input.variants.map(variant => ({ ...variantData(variant), ...variantDetails(variant) }))
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const saved = await tx.product.create({ data: { name, description, slug, productVariant_product: { create: variants } } })
        await assignProductDetails(tx, saved.id, input, adminId)
        if (input.categoryIds !== undefined) await assignCategories(tx, saved.id, input.categoryIds)
        await audit(tx, adminId, 'Product', saved.id, 'CREATE_DRAFT_PRODUCT', reason, undefined, { name, slug })
        return { id: saved.id, published: false }
      })
    },
    async updateProduct(adminId, productId, input) {
      id(productId); const reason = accountText(input?.reason, 'Motivo', 500), data = {}
      if (input.featuredPosition !== undefined) {
        try { data.featuredPosition = featuredPosition(input.featuredPosition) } catch (error) { throw new AccountError(400, error.message) }
      }
      for (const key of ['name', 'description']) if (input[key] !== undefined) data[key] = accountText(input[key], key, key === 'name' ? 120 : 10000)
      if (input.slug !== undefined) {
        data.slug = accountText(input.slug, 'Identificador de URL', 150)
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new AccountError(400, 'Identificador de URL inválido.')
      }
      if (input.deactivate === true) data.deletedAt = new Date()
      if (input.published !== undefined && typeof input.published !== 'boolean') throw new AccountError(400, 'Publicación inválida.')
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`
        const product = await tx.product.findUnique({ where: { id: productId } })
        if (!product) throw new AccountError(404, 'Producto no disponible.')
        if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== product.updatedAt.toISOString()) throw new AccountError(409, 'El producto cambió. Actualiza la información antes de guardar.')
        if (product.deletedAt) throw new AccountError(409, 'Un producto desactivado no se puede modificar.')
        if (input.variants !== undefined) {
          if (!Array.isArray(input.variants) || !input.variants.length || input.variants.length > 100 || input.variants.some(variant => !variant || typeof variant !== 'object' || Array.isArray(variant)) || new Set(input.variants.map(variant => variant.id)).size !== input.variants.length) throw new AccountError(400, 'Variantes inválidas.')
          for (const variant of [...input.variants].sort((a,b) => String(a.id).localeCompare(String(b.id)))) await changeVariant(tx, adminId, variant.id, { ...variant, reason }, productId)
        }
        if (input.published === true) {
          if (product.deletedAt || data.deletedAt) throw new AccountError(409, 'Un producto desactivado no se puede publicar.')
          const [variants, images] = await Promise.all([tx.productVariant.count({ where: { productId, deletedAt: null } }), tx.productMedia.count({ where: { productId, kind: 'FRONT' } })])
          if (!variants || !images) throw new AccountError(409, 'Antes de publicar configura variantes e imagen frontal documentada.')
          data.publishedAt = new Date()
        } else if (input.published === false) data.publishedAt = null
        await assignProductDetails(tx, productId, input, adminId)
        if (input.categoryIds !== undefined) await assignCategories(tx, productId, input.categoryIds)
        await tx.product.update({ where: { id: productId }, data })
        await audit(tx, adminId, 'Product', productId, 'UPDATE_PRODUCT', reason, { name: product.name, published: !!product.publishedAt, deactivated: !!product.deletedAt, featuredPosition: product.featuredPosition }, { featuredPosition: data.featuredPosition === undefined ? product.featuredPosition : data.featuredPosition, name: data.name ?? product.name, published: input.published ?? !!product.publishedAt, deactivated: !!(data.deletedAt ?? product.deletedAt), categoryIds: input.categoryIds ?? null })
        return { id: productId }
      })
    },
    async reactivateProduct(adminId, productId, input) {
      id(productId)
      const reason = accountText(input?.reason, 'Motivo', 500)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`
        const product = await tx.product.findUnique({ where: { id: productId } })
        if (!product) throw new AccountError(404, 'Producto no disponible.')
        if (input.expectedUpdatedAt !== product.updatedAt.toISOString()) throw new AccountError(409, 'El producto cambió. Actualiza la información antes de reactivar.')
        if (!product.deletedAt) throw new AccountError(409, 'El producto ya está activo.')
        await tx.product.update({ where: { id: productId }, data: { deletedAt: null, publishedAt: null } })
        await audit(tx, adminId, 'Product', productId, 'REACTIVATE_PRODUCT', reason, { deactivated: true, published: !!product.publishedAt }, { deactivated: false, published: false })
        return { id: productId, published: false }
      })
    },
    async updateVariant(adminId, variantId, input) {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        return changeVariant(tx, adminId, variantId, input)
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
