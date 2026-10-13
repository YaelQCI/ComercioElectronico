import { validateCatalogManifest } from './catalog-manifest.js'

// This creates a reviewed batch once. Conflicts abort the whole transaction;
// existing catalog, prices and inventory history are never silently overwritten.
export async function importCatalog(database, input, { resolveAsset }) {
  const manifest = validateCatalogManifest(input)
  const assets = new Map()
  for (const product of manifest.products) {
    for (const asset of [...product.images, ...product.variants.flatMap(v => v.lots.map(l => l.certificate).filter(Boolean))]) {
      if (!assets.has(asset.path)) assets.set(asset.path, await resolveAsset(asset.path))
    }
  }
  return database.$transaction(async tx => {
    const ids = []
    async function saveAsset(path) {
      const metadata = assets.get(path)
      const existing = await tx.mediaAsset.findUnique({ where: { storageKey: path } })
      if (existing) {
        if (existing.checksum !== metadata.checksum || existing.mimeType !== metadata.mimeType || existing.byteSize !== BigInt(metadata.byteSize)) throw new Error('Un archivo existente cambió; requiere una nueva ruta de recurso.')
        return existing.id
      }
      return (await tx.mediaAsset.create({ data: { storageKey: path, ...metadata, byteSize: BigInt(metadata.byteSize) } })).id
    }
    for (const product of manifest.products) {
      const brand = product.brand ? await tx.brand.upsert({ where: { slug: product.brand.slug }, create: product.brand, update: {} }) : null
      if (brand && (!brand.isActive || brand.name !== product.brand.name)) throw new Error('Marca existente incompatible con el manifiesto.')
      const created = await tx.product.create({ data: { name: product.name, slug: product.slug, description: product.description, ingredients: product.ingredients, usageInstructions: product.usageInstructions, allergenInformation: product.allergenInformation, brandId: brand?.id, publishedAt: product.publish ? new Date() : null } })
      for (const [index, category] of product.categories.entries()) {
        const saved = await tx.category.upsert({ where: { slug: category.slug }, create: category, update: {} })
        if (!saved.isActive || saved.name !== category.name) throw new Error('Categoría existente incompatible con el manifiesto.')
        await tx.productCategory.create({ data: { productId: created.id, categoryId: saved.id, isPrimary: index === 0 } })
      }
      for (const facet of product.facets) {
        const saved = await tx.facet.upsert({ where: { kind_slug: { kind: facet.kind, slug: facet.slug } }, create: facet, update: {} })
        if (saved.name !== facet.name) throw new Error('Filtro existente incompatible con el manifiesto.')
        await tx.productFacet.create({ data: { productId: created.id, facetId: saved.id } })
      }
      const variants = new Map()
      for (const variant of product.variants) {
        const { lots, nutritionData, ...fields } = variant
        const [normalized] = await tx.$queryRaw`SELECT lower(btrim(${variant.flavor}::text)) AS flavor, lower(btrim(${variant.presentationLabel}::text)) AS presentation`
        const saved = await tx.productVariant.create({ data: { ...fields, ...(nutritionData == null ? {} : { nutritionData }), productId: created.id, flavorNormalized: normalized.flavor, presentationNormalized: normalized.presentation, priceCents: BigInt(variant.priceCents), compareAtPriceCents: variant.compareAtPriceCents == null ? null : BigInt(variant.compareAtPriceCents) } })
        variants.set(variant.sku, saved.id)
        for (const lot of lots) {
          const { initialQty, certificate, expiresOn, importedOn, ...lotFields } = lot
          const savedLot = await tx.inventoryLot.create({ data: { ...lotFields, variantId: saved.id, expiresOn: expiresOn ? new Date(`${expiresOn}T00:00:00Z`) : null, importedOn: importedOn ? new Date(`${importedOn}T00:00:00Z`) : null, certificateAssetId: certificate ? await saveAsset(certificate.path) : null } })
          if (initialQty) await tx.inventoryMovement.create({ data: { lotId: savedLot.id, kind: 'RECEIPT', onHandDelta: initialQty, actorType: 'SYSTEM', reason: 'Recepción inicial de catálogo revisado', idempotencyKey: `catalog-import:${savedLot.id}` } })
        }
      }
      for (const [position, image] of product.images.entries()) {
        await tx.productMedia.create({ data: { productId: created.id, variantId: image.variantSku ? variants.get(image.variantSku) : null, assetId: await saveAsset(image.path), kind: image.kind, altText: image.alt, position } })
      }
      ids.push(created.id)
    }
    return { importedProducts: ids.length, productIds: ids }
  }, { timeout: 60000 })
}
