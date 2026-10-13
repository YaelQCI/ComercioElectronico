// Import format for reviewed catalog data. No framework or database dependencies.
export class CatalogValidationError extends Error {}
const fail = path => { throw new CatalogValidationError(`Dato inválido: ${path}`) }
const text = (value, path, max = 500) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail(path)
const nullableText = (value, path, max) => value == null ? null : text(value, path, max)
const list = (value, path, min = 0) => Array.isArray(value) && value.length >= min && value.length <= 1000 ? value : fail(path)
const integer = (value, path, min = 1) => Number.isSafeInteger(value) && value >= min && value <= 2147483647 ? value : fail(path)
const decimal = (value, path) => typeof value === 'string' && /^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(value) && Number(value) > 0 ? value : fail(path)
const cents = (value, path) => typeof value === 'string' && /^(?:0|[1-9]\d{0,14})$/.test(value) ? value : fail(path)
const slug = (value, path) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(value, path, 150)) ? value : fail(path)
const uuid = (value, path) => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) ? value : fail(path)
function date(value, path) {
  if (value == null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(path)
  return value
}
function unique(set, value, path) { if (set.has(value)) fail(`${path} duplicado`); set.add(value) }
function asset(value, path, certificate = false) {
  if (!value || typeof value !== 'object') fail(path)
  const file = text(value.path, `${path}.path`, 300)
  const pattern = certificate ? /^\/certificates\/[a-zA-Z0-9/_-]+\.pdf$/ : /^\/images\/catalog\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)$/
  if (!pattern.test(file) || file.slice(1).split('/').some(part => !part)) fail(`${path}.path`)
  return { path: file, alt: certificate ? null : text(value.alt, `${path}.alt`) }
}
export function validateCatalogManifest(input) {
  if (!input || input.version !== 1) fail('version')
  const productSlugs = new Set(), skus = new Set(), categoryNames = new Map(), facetNames = new Map()
  const taxonomy = (values, path, registry) => list(values, path).map((item, index) => {
    const p = `${path}[${index}]`, key = slug(item?.slug, `${p}.slug`), name = text(item.name, `${p}.name`)
    if (registry.has(key) && registry.get(key) !== name) fail(`${p}.name contradictorio`)
    registry.set(key, name)
    return { slug: key, name }
  })
  const products = list(input.products, 'products', 1).map((product, index) => {
    const p = `products[${index}]`
    if (!product || typeof product !== 'object') fail(p)
    const productSlug = slug(product.slug, `${p}.slug`)
    unique(productSlugs, productSlug, `${p}.slug`)
    if (product.publish != null && typeof product.publish !== 'boolean') fail(`${p}.publish`)
    const categories = taxonomy(product.categories, `${p}.categories`, categoryNames)
    if (!categories.length || new Set(categories.map(c => c.slug)).size !== categories.length) fail(`${p}.categories`)
    const facets = ['goals', 'disciplines'].flatMap((key, kindIndex) => {
      const kind = kindIndex ? 'DISCIPLINE' : 'GOAL'
      const values = taxonomy(product[key] ?? [], `${p}.${key}`, facetNames.get(kind) ?? facetNames.set(kind, new Map()).get(kind))
      if (new Set(values.map(f => f.slug)).size !== values.length) fail(`${p}.${key}`)
      return values.map(f => ({ ...f, kind }))
    })
    const variants = list(product.variants, `${p}.variants`, 1).map((variant, variantIndex) => {
      const v = `${p}.variants[${variantIndex}]`
      if (!variant || typeof variant !== 'object') fail(v)
      const sku = text(variant.sku, `${v}.sku`, 80)
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(sku)) fail(`${v}.sku`)
      unique(skus, sku, `${v}.sku`)
      const priceCents = cents(variant.priceCents, `${v}.priceCents`)
      const compareAtPriceCents = variant.compareAtPriceCents == null ? null : cents(variant.compareAtPriceCents, `${v}.compareAtPriceCents`)
      if (compareAtPriceCents != null && BigInt(compareAtPriceCents) <= BigInt(priceCents)) fail(`${v}.compareAtPriceCents debe ser mayor al precio vigente`)
      if ((variant.servingAmount == null) !== (variant.servingUnit == null)) fail(`${v}.servingAmount/servingUnit`)
      const seenLots = new Set()
      const lots = list(variant.lots ?? [], `${v}.lots`).map((lot, lotIndex) => {
        const l = `${v}.lots[${lotIndex}]`
        if (!lot || typeof lot !== 'object') fail(l)
        const warehouseId = uuid(lot.warehouseId, `${l}.warehouseId`), lotCode = text(lot.lotCode, `${l}.lotCode`, 100)
        unique(seenLots, `${warehouseId}:${lotCode}`, l)
        const expiresOn = date(lot.expiresOn, `${l}.expiresOn`)
        const expiryPrecision = lot.expiryPrecision ?? null
        if ((expiresOn && !['DAY', 'MONTH'].includes(expiryPrecision)) || (!expiresOn && expiryPrecision)) fail(`${l}.expiryPrecision`)
        if (expiryPrecision === 'MONTH') {
          const nextDay = new Date(`${expiresOn}T00:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1)
          if (nextDay.getUTCDate() !== 1) fail(`${l}.expiresOn debe ser el último día del mes`)
        }
        return { warehouseId, lotCode, expiresOn, expiryPrecision, importedOn: date(lot.importedOn, `${l}.importedOn`), customsEntry: nullableText(lot.customsEntry, `${l}.customsEntry`), origin: nullableText(lot.origin, `${l}.origin`), initialQty: integer(lot.initialQty ?? 0, `${l}.initialQty`, 0), certificate: lot.certificate == null ? null : asset(lot.certificate, `${l}.certificate`, true) }
      })
      const nutritionData = variant.nutritionData ?? null
      if (nutritionData != null && (typeof nutritionData !== 'object' || Array.isArray(nutritionData) || JSON.stringify(nutritionData).length > 20000)) fail(`${v}.nutritionData`)
      return { sku, flavor: text(variant.flavor, `${v}.flavor`, 150), presentationLabel: text(variant.presentationLabel, `${v}.presentationLabel`, 150), contentAmount: decimal(variant.contentAmount, `${v}.contentAmount`), contentUnit: text(variant.contentUnit, `${v}.contentUnit`, 30), servings: variant.servings == null ? null : decimal(variant.servings, `${v}.servings`), servingAmount: variant.servingAmount == null ? null : decimal(variant.servingAmount, `${v}.servingAmount`), servingUnit: nullableText(variant.servingUnit, `${v}.servingUnit`, 30), nutritionData, priceCents, compareAtPriceCents, weightGrams: integer(variant.weightGrams, `${v}.weightGrams`), lengthMm: integer(variant.lengthMm, `${v}.lengthMm`), widthMm: integer(variant.widthMm, `${v}.widthMm`), heightMm: integer(variant.heightMm, `${v}.heightMm`), lots }
    })
    const normalize = value => value.trim().normalize('NFKC').toLocaleLowerCase('es-MX')
    const combinations = new Set()
    variants.forEach(v => unique(combinations, `${normalize(v.flavor)}\u0000${normalize(v.presentationLabel)}`, `${p}.presentación`))
    const images = list(product.images, `${p}.images`, 1).map((image, i) => {
      const a = asset(image, `${p}.images[${i}]`)
      if (!['FRONT', 'NUTRITION', 'GALLERY'].includes(image.kind)) fail(`${p}.images[${i}].kind`)
      if (image.variantSku && !variants.some(v => v.sku === image.variantSku)) fail(`${p}.images[${i}].variantSku`)
      return { ...a, kind: image.kind, variantSku: image.variantSku ?? null }
    })
    if (!images.some(i => i.kind === 'FRONT')) fail(`${p}.images debe incluir FRONT`)
    return { slug: productSlug, name: text(product.name, `${p}.name`), description: text(product.description, `${p}.description`, 20000), ingredients: nullableText(product.ingredients, `${p}.ingredients`, 10000), usageInstructions: nullableText(product.usageInstructions, `${p}.usageInstructions`, 10000), allergenInformation: nullableText(product.allergenInformation, `${p}.allergenInformation`, 10000), brand: product.brand ? { slug: slug(product.brand.slug, `${p}.brand.slug`), name: text(product.brand.name, `${p}.brand.name`) } : null, publish: product.publish === true, categories, facets, goals: facets.filter(f => f.kind === 'GOAL').map(({ slug, name }) => ({ slug, name })), disciplines: facets.filter(f => f.kind === 'DISCIPLINE').map(({ slug, name }) => ({ slug, name })), images, variants }
  })
  return { version: 1, products }
}
