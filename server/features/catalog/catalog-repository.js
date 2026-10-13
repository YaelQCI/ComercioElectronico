import { searchPattern } from '../../../shared/features/catalog/search.js'

const published = () => ({ deletedAt: null, publishedAt: { lte: new Date() }, productVariant_product: { some: { deletedAt: null } }, OR: [{ brandId: null }, { brand: { isActive: true } }] })
const includes = {
  brand: true,
  productCategory_product: { where: { category: { isActive: true } }, include: { category: true } },
  productFacet_product: { include: { facet: true } },
  productVariant_product: { where: { deletedAt: null }, orderBy: [{ priceCents: 'asc' }, { id: 'asc' }] },
  productMedia_product: { include: { asset: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
}
function publicImage(media) {
  // Local reviewed assets supported by the importer. Never expose storage internals.
  if (!/^\/images\/catalog\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)$/.test(media.asset.storageKey)) return null
  return { id: media.id, url: media.asset.storageKey, alt: media.altText, kind: media.kind, variantId: media.variantId }
}
export function catalogProductDTO(product) {
  return {
    id: product.id, slug: product.slug, name: product.name, description: product.description,
    ingredients: product.ingredients, usageInstructions: product.usageInstructions, allergenInformation: product.allergenInformation,
    brand: product.brand ? { name: product.brand.name, slug: product.brand.slug } : null,
    categories: product.productCategory_product.map(({ category, isPrimary }) => ({ slug: category.slug, name: category.name, isPrimary })),
    facets: product.productFacet_product.map(({ facet }) => ({ kind: facet.kind, slug: facet.slug, name: facet.name })),
    images: product.productMedia_product.map(publicImage).filter(Boolean),
    variants: product.productVariant_product.map(v => ({ id: v.id, sku: v.sku, flavor: v.flavor, presentationLabel: v.presentationLabel, contentAmount: v.contentAmount.toString(), contentUnit: v.contentUnit, servings: v.servings?.toString() ?? null, servingAmount: v.servingAmount?.toString() ?? null, servingUnit: v.servingUnit, nutritionData: v.nutritionData, priceCents: v.priceCents.toString(), compareAtPriceCents: v.compareAtPriceCents?.toString() ?? null, weightGrams: v.weightGrams, lengthMm: v.lengthMm, widthMm: v.widthMm, heightMm: v.heightMm })),
  }
}
export function createCatalogRepository(db) {
  return {
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
      const products = await db.product.findMany({ where: { ...published(), ...(ids ? { id: { in: ids } } : {}) }, include: includes, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 100 })
      return products.map(catalogProductDTO)
    },
    async getById(id) {
      const product = await db.product.findFirst({ where: { ...published(), id }, include: includes })
      return product ? catalogProductDTO(product) : null
    },
  }
}
