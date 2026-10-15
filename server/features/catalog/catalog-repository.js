import { searchPattern } from '../../../shared/features/catalog/search.js'
import { availableFromLots } from '../../../shared/features/inventory/availability.js'
import { filterProducts, catalogFilterOptions } from '../../../shared/features/catalog/filters.js'
import { paginateCatalog } from '../../../shared/features/catalog/pagination.js'
import { sellableLots } from '../../../shared/features/inventory/lots.js'
import { publicBundle, bundleIncludes } from './bundle-repository.js'

const published = () => ({ deletedAt: null, publishedAt: { lte: new Date() }, productVariant_product: { some: { deletedAt: null } }, OR: [{ brandId: null }, { brand: { isActive: true } }] })
const includes = {
  brand: true,
  productCategory_product: { where: { category: { isActive: true } }, include: { category: true } },
  productFacet_product: { include: { facet: true } },
  productVariant_product: { where: { deletedAt: null }, include: { inventoryLot_variant: { include: { warehouse: { select: { timezone: true } }, certificateAsset: true } } }, orderBy: [{ priceCents: 'asc' }, { id: 'asc' }] },
  productMedia_product: { include: { asset: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
}
export function publicImage(media) {
  // Local reviewed assets supported by the importer. Never expose storage internals.
  const uploaded = /^uploads\/[0-9a-f-]{36}\.webp$/.test(media.asset.storageKey)
  if (!uploaded && !/^\/images\/catalog\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)$/.test(media.asset.storageKey)) return null
  return { id: media.id, url: uploaded ? `/api/catalog/images/${media.asset.id}` : media.asset.storageKey, alt: media.altText, kind: media.kind, variantId: media.variantId }
}
function publicLots(variant) {
  return sellableLots(variant.inventoryLot_variant).map(lot => ({ id: lot.id, lotCode: lot.lotCode, expiresOn: lot.expiresOn?.toISOString().slice(0, 10) ?? null, expiryPrecision: lot.expiryPrecision, importedOn: lot.importedOn?.toISOString().slice(0, 10) ?? null, customsEntry: lot.customsEntry, origin: lot.origin, availableQty: lot.onHandQty - lot.reservedQty, certificateUrl: lot.certificateAsset?.mimeType === 'application/pdf' ? `/api/catalog/lots/${lot.id}/certificate` : null }))
}
export function catalogProductDTO(product) {
  return {
    id: product.id, slug: product.slug, name: product.name, description: product.description,
    publishedAt: product.publishedAt?.toISOString() ?? null, featuredPosition: product.featuredPosition,
    ingredients: product.ingredients, usageInstructions: product.usageInstructions, allergenInformation: product.allergenInformation,
    brand: product.brand ? { name: product.brand.name, slug: product.brand.slug } : null,
    categories: product.productCategory_product.map(({ category, isPrimary }) => ({ slug: category.slug, name: category.name, isPrimary })),
    facets: product.productFacet_product.map(({ facet }) => ({ kind: facet.kind, slug: facet.slug, name: facet.name })),
    images: product.productMedia_product.map(publicImage).filter(Boolean),
    variants: product.productVariant_product.map(v => ({ id: v.id, sku: v.sku, flavor: v.flavor, presentationLabel: v.presentationLabel, contentAmount: v.contentAmount.toString(), contentUnit: v.contentUnit, servings: v.servings?.toString() ?? null, servingAmount: v.servingAmount?.toString() ?? null, servingUnit: v.servingUnit, nutritionData: v.nutritionData, priceCents: v.priceCents.toString(), compareAtPriceCents: v.compareAtPriceCents?.toString() ?? null, availableQty: availableFromLots(v.inventoryLot_variant), lots: publicLots(v), weightGrams: v.weightGrams, lengthMm: v.lengthMm, widthMm: v.widthMm, heightMm: v.heightMm })),
  }
}
export function createCatalogRepository(db) {
  return {
    async imageAsset(id) {
      return db.mediaAsset.findFirst({ where: { id, productMedia_asset: { some: { product: published() } } } })
    },
    async bundles() {
      const bundles = await db.bundle.findMany({ where: { deletedAt: null }, include: bundleIncludes, orderBy: [{ featuredPosition: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], take: 1001 })
      if (bundles.length > 1000) throw new Error('Límite de lectura de combos excedido.')
      return bundles.map(b => publicBundle(b)).filter(Boolean)
    },
    async recommendations(sourceIds, kind, excludedVariantIds = []) {
      if (!sourceIds.length) return []
      const relations = await db.productRelation.findMany({ where: { sourceProductId: { in: sourceIds }, kind, sourceProduct: published(), targetProduct: published() }, include: { targetProduct: { include: includes } }, orderBy: [{ position: 'asc' }, { targetProductId: 'asc' }], take: 100 })
      const seen = new Set()
      return relations.map(r => catalogProductDTO(r.targetProduct)).filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); p.variants = p.variants.filter(v => !excludedVariantIds.includes(v.id)); return p.variants.length > 0 }).slice(0, 8)
    },
    async home() {
      const [products, categories] = await db.$transaction([
        db.product.findMany({ where: { ...published(), featuredPosition: { not: null } }, include: includes, orderBy: [{ featuredPosition: 'asc' }, { id: 'asc' }], take: 8 }),
        db.category.findMany({ where: { isActive: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { slug: true, name: true, _count: { select: { productCategory_category: { where: { product: published() } } } } } }),
      ])
      return { featured: products.map(catalogProductDTO), categories: categories.map(c => ({ slug: c.slug, name: c.name, productCount: c._count.productCategory_category })) }
    },
    async list({ q = '' } = {}) {
      let ids = null
      if (q) {
        const pattern = searchPattern(q)
        const likeEscape = '\\'
        const marks = Array.from({ length: 112 }, (_, i) => String.fromCharCode(0x300 + i)).join('')
        const matches = await db.$queryRaw`
          SELECT DISTINCT p.id FROM "Product" p
          LEFT JOIN "ProductVariant" v ON v."productId" = p.id AND v."deletedAt" IS NULL
          LEFT JOIN "ProductCategory" pc ON pc."productId" = p.id
          LEFT JOIN "Category" c ON c.id = pc."categoryId" AND c."isActive" = true
          WHERE translate(lower(normalize(p.name, NFKD)), ${marks}, '') LIKE ${pattern} ESCAPE ${likeEscape}
             OR translate(lower(normalize(v.sku, NFKD)), ${marks}, '') LIKE ${pattern} ESCAPE ${likeEscape}
             OR translate(lower(normalize(c.name, NFKD)), ${marks}, '') LIKE ${pattern} ESCAPE ${likeEscape}
        `
        ids = matches.map(m => m.id)
      }
      const products = await db.product.findMany({ where: { ...published(), ...(ids ? { id: { in: ids } } : {}) }, include: includes, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 10001 })
      if (products.length > 10000) throw new Error('Catálogo excede el límite de lectura configurado; requiere consulta indexada.')
      return products.map(catalogProductDTO)
    },
    async browse(filters, pagination) {
      const all = await this.list()
      const queried = filters.q ? await this.list({ q: filters.q }) : all
      return { ...paginateCatalog(filterProducts(queried, filters), { ...pagination, q: filters.q }), options: catalogFilterOptions(all), catalogTotal: all.length }
    },
    async getById(id) {
      const product = await db.product.findFirst({ where: { ...published(), id }, include: includes })
      return product ? catalogProductDTO(product) : null
    },
    async certificateForLot(id) {
      const lot = await db.inventoryLot.findFirst({ where: { id, variant: { deletedAt: null, product: published() } }, include: { certificateAsset: true } })
      return lot?.certificateAsset ?? null
    },
  }
}
