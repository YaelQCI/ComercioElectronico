import { CouponError } from '../../../shared/features/coupons/coupon-eligibility.js'
import { evaluateCartCoupon } from './cart-coupon.js'

export async function checkCartCoupon(tx, cart, items, { userId, email } = {}) {
  if (!cart.selectedCoupon) return null
  const coupon = cart.selectedCoupon
  let customerUses = null
  if (coupon.maxUsesPerCustomer != null && (userId || email)) {
    const identities = []
    if (userId) identities.push({ identityKey: `user:${userId}` })
    if (email) identities.push({ emailNormalizedSnapshot: email.trim().toLowerCase() })
    customerUses = await tx.couponUsage.count({ where: { couponId: coupon.id, state: { in: ['RESERVED', 'CONSUMED'] }, OR: identities } })
  }
  return evaluateCartCoupon(cart, items, { customerUses })
}

// La selección de una visita anterior no se reutiliza automáticamente.
export async function reviewCartCoupon(tx, cart, items, selection, identity) {
  if (!cart.selectedCoupon) return { cart, notice: null }
  let notice = null
  if (selection !== `${cart.id}:${cart.selectedCoupon.id}`) notice = 'Retiramos el cupón guardado de una sesión o compra anterior. Si deseas usarlo en esta compra, ingrésalo de nuevo.'
  else try { await checkCartCoupon(tx, cart, items, identity) } catch (error) {
    if (!(error instanceof CouponError)) throw error
    notice = `${error.message} Retiramos el cupón; revisa el total y vuelve a ingresarlo si corresponde.`
  }
  if (!notice) return { cart, notice: null }
  await tx.cart.update({ where: { id: cart.id }, data: { selectedCouponId: null, version: { increment: 1 } } })
  await tx.shippingQuote.updateMany({ where: { cartId: cart.id, status: { in: ['AVAILABLE', 'ACCEPTED'] } }, data: { status: 'INVALIDATED' } })
  return { cart: { ...cart, selectedCouponId: null, selectedCoupon: null, version: cart.version + 1 }, notice }
}
