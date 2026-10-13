import { money, roundRatio, allocateCents } from '../pricing/prices.js'

export class CouponError extends Error {}
export function couponCode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(value.trim())) throw new CouponError('Escribe un código de cupón válido.')
  return value.trim().toLowerCase()
}
export function evaluateCoupon(coupon, lines, { now = new Date(), globalUses = 0, customerUses = null } = {}) {
  if (!coupon?.isActive) throw new CouponError('Cupón inexistente o inactivo.')
  if ((coupon.startsAt && new Date(coupon.startsAt) > now) || (coupon.endsAt && new Date(coupon.endsAt) <= now)) throw new CouponError('Cupón fuera de su periodo de vigencia.')
  if ((coupon.maxUses != null && globalUses >= coupon.maxUses) || (coupon.maxUsesPerCustomer != null && customerUses != null && customerUses >= coupon.maxUsesPerCustomer)) throw new CouponError('El cupón alcanzó su límite de usos.')
  const productIds = new Set(coupon.productIds ?? []), categoryIds = new Set(coupon.categoryIds ?? [])
  const eligible = lines.map(line => {
    if (line.components.reduce((sum,c) => sum + money(c.allocatedBaseCents), 0n) !== money(line.baseCents)) throw new RangeError('Base por componentes inconsistente.')
    let amount = 0n
    const components = line.components.map(component => {
      const reference = money(component.referencePriceCents), compare = component.compareAtPriceCents == null ? reference : money(component.compareAtPriceCents)
      const scoped = coupon.scope === 'CATALOG' || (coupon.scope === 'PRODUCTS' && productIds.has(component.productId)) || (coupon.scope === 'CATEGORIES' && component.categoryIds.some(id => categoryIds.has(id)))
      const allowed = scoped && (!line.isBundle || coupon.allowBundles) && (coupon.allowOffers || compare <= reference)
      const cents = allowed ? money(component.allocatedBaseCents) : 0n
      amount += cents
      return { id: component.id, eligibleCents: cents.toString() }
    })
    if (amount > money(line.baseCents)) throw new RangeError('Elegibilidad inconsistente.')
    return { id: line.id, eligibleCents: amount.toString(), components }
  })
  const total = eligible.reduce((sum, line) => sum + money(line.eligibleCents), 0n)
  if (!total) throw new CouponError('No hay productos elegibles para este cupón.')
  if (coupon.minimumEligibleCents != null && total < money(coupon.minimumEligibleCents)) throw new CouponError('No se alcanza la compra mínima de productos elegibles.')
  let discount
  if (coupon.kind === 'FIXED') discount = money(coupon.fixedAmountCents)
  else if (coupon.kind === 'PERCENTAGE' && Number.isInteger(coupon.percentageBasisPoints) && coupon.percentageBasisPoints > 0 && coupon.percentageBasisPoints <= 10000) discount = roundRatio(total * BigInt(coupon.percentageBasisPoints), 10000n)
  else throw new CouponError('Configuración de cupón inválida.')
  if (discount > total) discount = total
  const allocation = new Map(allocateCents(discount, eligible.map(l => ({ id: l.id, weightCents: l.eligibleCents }))).map(l => [l.id, l.cents]))
  return { eligibleCents: total.toString(), discountCents: discount.toString(), customerLimitPending: coupon.maxUsesPerCustomer != null && customerUses == null, lines: eligible.map(l => ({ ...l, discountCents: allocation.get(l.id), components: allocateCents(allocation.get(l.id), l.components.map(c => ({ id: c.id, weightCents: c.eligibleCents }))) })) }
}
