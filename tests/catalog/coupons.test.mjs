import test from 'node:test'
import assert from 'node:assert/strict'
import { couponCode, evaluateCoupon } from '../../shared/features/coupons/coupon-eligibility.js'
import { calculateCart } from '../../shared/features/pricing/prices.js'
const coupon = (overrides = {}) => ({ isActive: true, kind: 'PERCENTAGE', percentageBasisPoints: 1000, scope: 'CATALOG', allowOffers: false, allowBundles: false, ...overrides })
const line = (overrides = {}) => ({ id: 'a', baseCents: '3000', isBundle: false, components: [{ id: 'c1', productId: 'p1', categoryIds: ['category'], referencePriceCents: '1000', allocatedBaseCents: '1000' }, { id: 'c2', productId: 'p2', categoryIds: [], referencePriceCents: '2000', allocatedBaseCents: '2000' }], ...overrides })
test('código, vigencia, mínimo y límites se validan; identidad pendiente no se inventa', () => {
  assert.equal(couponCode(' SAVE_10 '), 'save_10')
  assert.throws(() => couponCode(''))
  assert.throws(() => evaluateCoupon(coupon({ endsAt: '2020-01-01' }), [line()]), /vigencia/)
  assert.throws(() => evaluateCoupon(coupon({ minimumEligibleCents: '3001' }), [line()]), /mínima/)
  assert.throws(() => evaluateCoupon(coupon({ maxUses: 1 }), [line()], { globalUses: 1 }), /límite/)
  assert.throws(() => evaluateCoupon(coupon({ maxUsesPerCustomer: 1 }), [line()], { customerUses: 1 }), /límite/)
  assert.equal(evaluateCoupon(coupon({ maxUsesPerCustomer: 1 }), [line()]).customerLimitPending, true)
})
test('ofertas y combos excluidos por defecto; habilitación solo descuenta parte elegible prorrateada', () => {
  const bundle = line({ isBundle: true })
  assert.throws(() => evaluateCoupon(coupon(), [bundle]), /elegibles/)
  const result = evaluateCoupon(coupon({ allowBundles: true, scope: 'PRODUCTS', productIds: ['p1'] }), [bundle])
  assert.equal(result.eligibleCents, '1000'); assert.equal(result.discountCents, '100')
  assert.deepEqual(result.lines[0].components, [{ id: 'c1', cents: '100' }, { id: 'c2', cents: '0' }])
  bundle.components[0].compareAtPriceCents = '1100'
  assert.throws(() => evaluateCoupon(coupon({ allowBundles: true, scope: 'CATEGORIES', categoryIds: ['category'] }), [bundle]), /elegibles/)
  assert.equal(evaluateCoupon(coupon({ allowBundles: true, allowOffers: true }), [bundle]).discountCents, '300')
})
test('fijo se limita al importe elegible y precios acepta elegibilidad parcial sin doble descuento', () => {
  const result = evaluateCoupon(coupon({ kind: 'FIXED', fixedAmountCents: '9999', scope: 'PRODUCTS', productIds: ['p1'] }), [line()])
  assert.equal(result.discountCents, '1000')
  const totals = calculateCart({ lines: [{ id: 'a', unitPriceCents: '3000', quantity: 1, eligibleAmountCents: '1000' }], coupon: { kind: 'FIXED', amountCents: '2000' }, shippingQuotedCents: '0' })
  assert.equal(totals.goodsAfterCouponCents, '2000')
  assert.throws(() => calculateCart({ lines: [{ id: 'a', unitPriceCents: '3000', quantity: 1, eligibleAmountCents: '3001' }], shippingQuotedCents: '0' }))
})
