import { availableFromLots } from '../../../shared/features/inventory/availability.js'
import { calculateCart } from '../../../shared/features/pricing/prices.js'
import { publicBundle } from '../catalog/bundle-repository.js'
import { cartCouponInclude, evaluateCartCoupon } from '../coupons/cart-coupon.js'
import { couponCode, CouponError } from '../../../shared/features/coupons/coupon-eligibility.js'

export class CartError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const variantInclude = { product: { include: { brand: true, productCategory_product: { where: { category: { isActive: true } } }, productMedia_product: { include: { asset: true }, orderBy: { position: 'asc' } } } }, inventoryLot_variant: { include: { warehouse: true } } }
const itemInclude = { variant: { include: variantInclude }, bundle: { include: { imageAsset: true, bundleComponent_bundle: { include: { variant: { include: variantInclude } } } } } }
function purchasable(v, now) {
  return v && !v.deletedAt && !v.product.deletedAt && v.product.publishedAt && v.product.publishedAt <= now && (!v.product.brand || v.product.brand.isActive)
}
function describe(item, now) {
  const components = item.variant ? [{ variant: item.variant, quantity: 1 }] : item.bundle?.bundleComponent_bundle ?? []
  const valid = components.length > 0 && (!item.bundle || !!publicBundle(item.bundle, now)) && components.every(c => purchasable(c.variant, now))
  const availableQty = valid ? Math.min(...components.map(c => Math.floor(availableFromLots(c.variant.inventoryLot_variant, now) / c.quantity))) : 0
  return { id: item.id, variantId: item.variantId, bundleId: item.bundleId, quantity: item.quantity, sku: item.variant?.sku ?? item.bundle?.code, name: item.variant?.product.name ?? item.bundle?.name, productId: item.variant?.productId ?? null, presentation: item.variant ? `${item.variant.presentationLabel} · ${item.variant.flavor}` : 'Combo', unitPriceCents: (item.variant?.priceCents ?? item.bundle.priceCents).toString(), availableQty, valid, components }
}
function snapshot(cart, items) {
  const now = new Date(), saved = items.filter(i => i.state === 'SAVED').map(item => { const { components, ...line } = describe(item, now); return line }), described = items.filter(i => i.state === 'ACTIVE').map(item => {
    const line = describe(item, now)
    line.bundle = item.bundle ? publicBundle(item.bundle, now) : null
    const media = item.variant?.product.productMedia_product.find(m => m.kind === 'FRONT' && m.variantId === item.variantId) ?? item.variant?.product.productMedia_product.find(m => m.kind === 'FRONT' && !m.variantId)
    const path = media?.asset.storageKey ?? item.bundle?.imageAsset?.storageKey
    line.image = /^\/images\/catalog\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)$/.test(path ?? '') ? { url: path, alt: media?.altText ?? item.bundle.name } : null
    return line
  })
  const demand = new Map()
  for (const line of described) for (const c of line.components) demand.set(c.variant.id, (demand.get(c.variant.id) ?? 0) + line.quantity * c.quantity)
  if ([...demand.values()].some(q => !Number.isSafeInteger(q) || q > 2147483647)) throw new CartError(400, 'La demanda agregada excede la capacidad técnica de inventario.')
  const lines = described.map(({ components, ...line }) => ({ ...line, maxQuantity: line.valid ? Math.max(0, Math.min(...components.map(c => Math.floor((availableFromLots(c.variant.inventoryLot_variant, now) - (demand.get(c.variant.id) - line.quantity * c.quantity)) / c.quantity)))) : 0, stockSufficient: line.valid && components.every(c => demand.get(c.variant.id) <= availableFromLots(c.variant.inventoryLot_variant, now)) }))
  let coupon = null, couponError = null
  if (cart?.selectedCoupon) try {
    if (lines.some(l => !l.valid)) throw new CouponError('Revisa los productos no disponibles antes de usar el cupón.')
    const result = evaluateCartCoupon(cart, items)
    coupon = { id: cart.selectedCoupon.id, code: cart.selectedCoupon.code, version: cart.selectedCoupon.version, ...result }
  } catch (error) { if (error instanceof CouponError) couponError = error.message; else throw error }
  const eligibility = new Map(coupon?.lines.map(l => [l.id, l.eligibleCents]) ?? [])
  const totals = lines.length ? calculateCart({ lines: lines.map(line => ({ id: line.id, unitPriceCents: line.unitPriceCents, quantity: line.quantity, eligibleAmountCents: eligibility.get(line.id) ?? '0' })), coupon: coupon ? { kind: 'FIXED', amountCents: coupon.discountCents } : null, shippingQuotedCents: '0' }) : null
  return { version: cart?.version ?? 1, lines, saved, coupon, couponError, pieces: [...demand.values()].reduce((sum, q) => sum + q, 0), products: lines.length, totals, provisional: true }
}
export const emptyCart = () => snapshot(null, [])
export async function shippingCart(tx, hash) {
  if (!hash) throw new CartError(404, 'Carrito no disponible.')
  const cart = await tx.cart.findFirst({ where: { guestTokenHash: hash, status: 'ACTIVE', userId: null }, include: cartCouponInclude })
  if (!cart) throw new CartError(404, 'Carrito no disponible.')
  const items = await tx.cartItem.findMany({ where: { cartId: cart.id, state: 'ACTIVE' }, include: itemInclude, orderBy: { id: 'asc' } })
  const current = snapshot(cart, items)
  if (!current.lines.length || current.lines.some(l => !l.stockSufficient)) throw new CartError(409, 'Revisa productos y existencias antes de cotizar.')
  const units = items.flatMap(item => (item.variant ? [{ variant: item.variant, quantity: 1 }] : item.bundle.bundleComponent_bundle).map(c => ({ variantId: c.variant.id, quantity: c.quantity * item.quantity, weightGrams: c.variant.weightGrams, lengthMm: c.variant.lengthMm, widthMm: c.variant.widthMm, heightMm: c.variant.heightMm })))
  units.sort((a,b) => a.variantId.localeCompare(b.variantId))
  return { cartId: cart.id, version: cart.version, baseCents: current.totals.goodsAfterCouponCents, lines: current.lines.map(l => ({ id: l.id, variantId: l.variantId, bundleId: l.bundleId, quantity: l.quantity, unitPriceCents: l.unitPriceCents, bundleVersion: l.bundle?.compositionVersion ?? null })), units, content: current.lines.map(l => l.name).join(', ').slice(0, 250) }
}
export function createCartRepository(db) {
  async function items(tx, id) { return tx.cartItem.findMany({ where: { cartId: id }, include: itemInclude, orderBy: [{ position: 'asc' }, { id: 'asc' }] }) }
  return {
    async read(hash) {
      if (!hash) return emptyCart()
      return db.$transaction(async tx => {
        const cart = await tx.cart.findFirst({ where: { guestTokenHash: hash, status: 'ACTIVE', userId: null }, include: cartCouponInclude })
        return cart ? snapshot(cart, await items(tx, cart.id)) : emptyCart()
      }, { isolationLevel: 'RepeatableRead' })
    },
    async add(hash, input) {
      if (!input || typeof input !== 'object') throw new CartError(400, 'Selección inválida.')
      const variantId = input.variantId ?? null, bundleId = input.bundleId ?? null
      if (!hash || (!!variantId === !!bundleId) || !Number.isInteger(input.version) || input.version < 1 || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 2147483647 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(variantId ?? bundleId ?? '')) throw new CartError(400, 'Selección o cantidad inválida.')
      return db.$transaction(async tx => {
        const cart = await tx.cart.upsert({ where: { guestTokenHash: hash }, create: { guestTokenHash: hash }, update: {} })
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id}::uuid FOR UPDATE`
        const current = await tx.cart.findUnique({ where: { id: cart.id }, include: cartCouponInclude })
        if (current.status !== 'ACTIVE' || current.userId) throw new CartError(409, 'Este carrito ya no está activo.')
        if (current.version !== input.version) throw new CartError(409, 'El carrito cambió. Actualízalo antes de continuar.')
        const existing = await tx.cartItem.findFirst({ where: { cartId: cart.id, variantId, bundleId, state: 'ACTIVE' } })
        const quantity = (existing?.quantity ?? 0) + input.quantity
        if (quantity > 2147483647) throw new CartError(400, 'Cantidad inválida.')
        if (variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: variantInclude })
          if (!purchasable(variant, new Date())) throw new CartError(404, 'Presentación no disponible.')
        } else {
          const bundle = await tx.bundle.findUnique({ where: { id: bundleId }, include: itemInclude.bundle.include })
          if (!bundle || !publicBundle(bundle)) throw new CartError(404, 'Combo no disponible.')
        }
        if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } })
        else await tx.cartItem.create({ data: { cartId: cart.id, variantId, bundleId, quantity } })
        const nextItems = await items(tx, cart.id)
        const next = snapshot(current, nextItems)
        if (next.lines.some(line => !line.stockSufficient)) throw new CartError(409, 'No hay stock suficiente para la demanda conjunta del carrito.')
        await tx.shippingQuote.updateMany({ where: { cartId: cart.id, status: { in: ['AVAILABLE', 'ACCEPTED'] } }, data: { status: 'INVALIDATED' } })
        const updated = await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } }, include: cartCouponInclude })
        return snapshot(updated, nextItems)
      })
    },
    async edit(hash, input, remove = false) {
      if (!hash || !input || !Number.isInteger(input.version) || input.version < 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.itemId ?? '') || (!remove && (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 2147483647))) throw new CartError(400, 'Línea o cantidad inválida.')
      return db.$transaction(async tx => {
        const cart = await tx.cart.findFirst({ where: { guestTokenHash: hash, status: 'ACTIVE', userId: null }, include: cartCouponInclude })
        if (!cart) throw new CartError(404, 'Carrito no disponible.')
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id}::uuid FOR UPDATE`
        const current = await tx.cart.findUnique({ where: { id: cart.id }, include: cartCouponInclude })
        if (current.status !== 'ACTIVE' || current.version !== input.version) throw new CartError(409, 'El carrito cambió. Actualízalo antes de continuar.')
        const item = await tx.cartItem.findFirst({ where: { id: input.itemId, cartId: cart.id, state: 'ACTIVE' } })
        if (!item) throw new CartError(404, 'Línea no disponible en tu carrito.')
        if (remove) await tx.cartItem.delete({ where: { id: item.id } })
        else await tx.cartItem.update({ where: { id: item.id }, data: { quantity: input.quantity } })
        const nextItems = await items(tx, cart.id)
        if (!remove && !snapshot(current, nextItems).lines.find(l => l.id === item.id)?.stockSufficient) throw new CartError(409, 'No hay stock suficiente para la demanda conjunta del carrito.')
        await tx.shippingQuote.updateMany({ where: { cartId: cart.id, status: { in: ['AVAILABLE', 'ACCEPTED'] } }, data: { status: 'INVALIDATED' } })
        const updated = await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } }, include: cartCouponInclude })
        return snapshot(updated, nextItems)
      })
    },
    async move(hash, input) {
      if (!hash || !input || !Number.isInteger(input.version) || input.version < 1 || !['SAVE', 'RESTORE', 'REMOVE'].includes(input.action) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.itemId ?? '')) throw new CartError(400, 'Acción inválida.')
      return db.$transaction(async tx => {
        const cart = await tx.cart.findFirst({ where: { guestTokenHash: hash, status: 'ACTIVE', userId: null }, include: cartCouponInclude })
        if (!cart) throw new CartError(404, 'Carrito no disponible.')
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id}::uuid FOR UPDATE`
        const current = await tx.cart.findUnique({ where: { id: cart.id }, include: cartCouponInclude })
        if (current.status !== 'ACTIVE' || current.version !== input.version) throw new CartError(409, 'El carrito cambió. Actualízalo antes de continuar.')
        const sourceState = input.action === 'SAVE' ? 'ACTIVE' : 'SAVED'
        const item = await tx.cartItem.findFirst({ where: { id: input.itemId, cartId: cart.id, state: sourceState } })
        if (!item) throw new CartError(404, 'Línea no disponible en tu carrito.')
        let targetId = item.id
        if (input.action === 'REMOVE') await tx.cartItem.delete({ where: { id: item.id } })
        else {
          const targetState = input.action === 'SAVE' ? 'SAVED' : 'ACTIVE'
          const target = await tx.cartItem.findFirst({ where: { cartId: cart.id, state: targetState, variantId: item.variantId, bundleId: item.bundleId } })
          const quantity = item.quantity + (target?.quantity ?? 0)
          if (quantity > 2147483647) throw new CartError(400, 'Cantidad inválida.')
          if (target) {
            await tx.cartItem.update({ where: { id: target.id }, data: { quantity } })
            await tx.cartItem.delete({ where: { id: item.id } })
            targetId = target.id
          } else await tx.cartItem.update({ where: { id: item.id }, data: { state: targetState } })
        }
        const nextItems = await items(tx, cart.id)
        if (input.action === 'RESTORE' && !snapshot(current, nextItems).lines.find(l => l.id === targetId)?.stockSufficient) throw new CartError(409, 'No hay stock suficiente para mover esta selección al carrito.')
        if (input.action !== 'REMOVE') await tx.shippingQuote.updateMany({ where: { cartId: cart.id, status: { in: ['AVAILABLE', 'ACCEPTED'] } }, data: { status: 'INVALIDATED' } })
        const updated = await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } }, include: cartCouponInclude })
        return snapshot(updated, nextItems)
      })
    },
    async coupon(hash, input) {
      if (!hash || !input || !Number.isInteger(input.version) || input.version < 1) throw new CartError(400, 'Carrito inválido.')
      let code = null
      try { if (input.remove !== true) code = couponCode(input.code) } catch (error) { throw new CartError(400, error.message) }
      return db.$transaction(async tx => {
        const cart = await tx.cart.findFirst({ where: { guestTokenHash: hash, status: 'ACTIVE', userId: null }, include: cartCouponInclude })
        if (!cart) throw new CartError(404, 'Carrito no disponible.')
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id}::uuid FOR UPDATE`
        const current = await tx.cart.findUnique({ where: { id: cart.id }, include: cartCouponInclude })
        if (current.status !== 'ACTIVE' || current.version !== input.version) throw new CartError(409, 'El carrito cambió. Actualízalo antes de continuar.')
        const coupon = code ? await tx.coupon.findUnique({ where: { codeNormalized: code } }) : null
        if (code && !coupon) throw new CartError(404, 'Cupón inexistente.')
        const updated = await tx.cart.update({ where: { id: cart.id }, data: { selectedCouponId: coupon?.id ?? null, version: { increment: 1 } }, include: cartCouponInclude })
        const result = snapshot(updated, await items(tx, cart.id))
        if (code && result.couponError) throw new CartError(409, result.couponError)
        await tx.shippingQuote.updateMany({ where: { cartId: cart.id, status: { in: ['AVAILABLE', 'ACCEPTED'] } }, data: { status: 'INVALIDATED' } })
        return result
      })
    },
  }
}
