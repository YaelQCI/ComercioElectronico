const published = () => ({ deletedAt: null, publishedAt: { lte: new Date() }, OR: [{ brandId: null }, { brand: { isActive: true } }] })
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
    async list() {
      const products = await db.product.findMany({ where: published(), include: includes, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 100 })
      return products.map(catalogProductDTO)
    },
    async getById(id) {
      const product = await db.product.findFirst({ where: { ...published(), id }, include: includes })
      return product ? catalogProductDTO(product) : null
    },
  }
}
