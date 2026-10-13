import { bundlePricing } from '../../../shared/features/pricing/prices.js'
import { evaluateCoupon } from '../../../shared/features/coupons/coupon-eligibility.js'

export const cartCouponInclude = { selectedCoupon: { include: { couponProduct_coupon: true, couponCategory_coupon: true, _count: { select: { couponUsage_coupon: { where: { state: { in: ['RESERVED', 'CONSUMED'] } } } } } } } }
export function couponDefinition(coupon) {
  return { ...coupon, minimumEligibleCents: coupon.minimumEligibleCents?.toString() ?? null, fixedAmountCents: coupon.fixedAmountCents?.toString() ?? null, productIds: coupon.couponProduct_coupon.map(p => p.productId), categoryIds: coupon.couponCategory_coupon.map(c => c.categoryId) }
}
export function cartCouponLines(items) {
  return items.filter(i => i.state === 'ACTIVE').map(item => {
    const parts = item.variant ? [{ variant: item.variant, quantity: 1 }] : item.bundle.bundleComponent_bundle
    const base = (item.variant?.priceCents ?? item.bundle.priceCents) * BigInt(item.quantity)
    const pricing = bundlePricing(base.toString(), parts.map(p => ({ id: p.variant.id, quantity: p.quantity * item.quantity, unitPriceCents: p.variant.priceCents.toString() })))
    const allocation = new Map(pricing.components.map(c => [c.id, c.cents]))
    return { id: item.id, baseCents: base.toString(), isBundle: !!item.bundleId, components: parts.map(p => ({ id: p.variant.id, productId: p.variant.productId, categoryIds: p.variant.product.productCategory_product.map(c => c.categoryId), referencePriceCents: p.variant.priceCents.toString(), compareAtPriceCents: p.variant.compareAtPriceCents?.toString() ?? null, allocatedBaseCents: allocation.get(p.variant.id) })) }
  })
}
export function evaluateCartCoupon(cart, items) {
  return evaluateCoupon(couponDefinition(cart.selectedCoupon), cartCouponLines(items), { globalUses: cart.selectedCoupon._count.couponUsage_coupon })
}
