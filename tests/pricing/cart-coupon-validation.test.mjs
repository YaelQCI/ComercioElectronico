import test from 'node:test'
import assert from 'node:assert/strict'
import { checkCartCoupon, reviewCartCoupon } from '../../server/features/coupons/check-cart-coupon.js'
import { CouponError } from '../../shared/features/coupons/coupon-eligibility.js'

const coupon = { id: 'coupon', isActive: true, kind: 'PERCENTAGE', percentageBasisPoints: 1000, scope: 'CATALOG', maxUses: 5, maxUsesPerCustomer: 1, couponProduct_coupon: [], couponCategory_coupon: [], _count: { couponUsage_coupon: 0 } }
const cart = () => ({ id: 'cart', version: 3, selectedCouponId: coupon.id, selectedCoupon: structuredClone(coupon) })
const items = [{ id: 'line', state: 'ACTIVE', quantity: 1, variant: { id: 'variant', productId: 'product', priceCents: 10000n, product: { productCategory_product: [] } } }]
function database(uses = 0) {
  const calls = []
  return { calls, couponUsage: { count: async query => { calls.push(query); return uses } }, cart: { update: async data => calls.push(data) }, shippingQuote: { updateMany: async data => calls.push(data) } }
}
test('comprueba usos globales y por identidad antes de confirmar; invitados sin correo quedan pendientes', async () => {
  const tx = database(1)
  await assert.rejects(checkCartCoupon(tx, cart(), items, { userId: 'user', email: 'User@example.com' }), CouponError)
  assert.deepEqual(tx.calls[0].where.OR, [{ identityKey: 'user:user' }, { emailNormalizedSnapshot: 'user@example.com' }])
  assert.deepEqual(tx.calls[0].where.state.in, ['RESERVED', 'CONSUMED'])
  assert.equal((await checkCartCoupon(database(), cart(), items)).customerLimitPending, true)
  assert.equal((await checkCartCoupon(database(), cart(), items, { email: 'guest@example.com' })).customerLimitPending, false)
  const exhausted = cart(); exhausted.selectedCoupon._count.couponUsage_coupon = 5
  await assert.rejects(checkCartCoupon(database(), exhausted, items), /límite de usos/)
})
test('retira una selección anterior, recalcula versión e invalida la tarifa sin consumir usos', async () => {
  const tx = database()
  const result = await reviewCartCoupon(tx, cart(), items, undefined, {})
  assert.equal(result.cart.selectedCouponId, null)
  assert.equal(result.cart.version, 4)
  assert.match(result.notice, /ingrésalo de nuevo/)
  assert.equal(tx.calls.length, 2)
  assert.equal(tx.calls[1].data.status, 'INVALIDATED')
})
test('conserva un cupón recién ingresado y disponible; retira el agotado antes de la compra', async () => {
  const fresh = await reviewCartCoupon(database(), cart(), items, 'cart:coupon', { email: 'guest@example.com' })
  assert.equal(fresh.cart.selectedCouponId, 'coupon')
  assert.equal(fresh.notice, null)
  const invalid = await reviewCartCoupon(database(1), cart(), items, 'cart:coupon', { email: 'guest@example.com' })
  assert.equal(invalid.cart.selectedCouponId, null)
  assert.match(invalid.notice, /límite de usos/)
})
