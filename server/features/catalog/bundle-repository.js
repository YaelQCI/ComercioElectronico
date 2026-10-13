import { bundleSummary } from '../../../shared/features/catalog/bundles.js'

export function publicBundle(bundle, now = new Date()) {
  return bundleSummary({ ...bundle, components: bundle.bundleComponent_bundle.map(({ variant: v, quantity }) => ({ variantId: v.id, productId: v.productId, sku: v.sku, name: v.product.name, presentation: `${v.presentationLabel} · ${v.flavor}`, quantity, unitPriceCents: v.priceCents.toString(), servings: v.servings?.toString() ?? null, lots: v.inventoryLot_variant, valid: !v.deletedAt && !v.product.deletedAt && v.product.publishedAt && v.product.publishedAt <= now && (!v.product.brand || v.product.brand.isActive) })) }, now)
}
export const bundleIncludes = { bundleComponent_bundle: { include: { variant: { include: { product: { include: { brand: true } }, inventoryLot_variant: { include: { warehouse: true } } } } } } }
