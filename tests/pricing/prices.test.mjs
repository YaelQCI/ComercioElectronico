import test from 'node:test'
import assert from 'node:assert/strict'
import { money, roundRatio, formatMXN, variantPricing, comparePresentations, allocateCents, bundlePricing, calculateCart } from '../../shared/features/pricing/prices.js'

test('MXN conserva enteros grandes y redondea mitades hacia arriba; entradas inválidas', () => {
  assert.equal(formatMXN('900719925474099199'), '$9,007,199,254,740,991.99 MXN')
  assert.equal(roundRatio(249n, 2n), 125n)
  for (const bad of [-1, 1.1, '-1', '1.00', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => money(bad))
})
test('costo por porción y precio anterior solo si mayor', () => {
  assert.equal(variantPricing({ priceCents: '74900', servings: '60', compareAtPriceCents: '70000' }).servingCostCents, '1248')
  assert.equal(variantPricing({ priceCents: '74900', servings: '60', compareAtPriceCents: '70000' }).compareAtPriceCents, null)
  assert.equal(variantPricing({ priceCents: '123', servings: '0.5' }).servingCostCents, '246')
  assert.equal(variantPricing({ priceCents: '123', servings: null }).servingCostCents, null)
  assert.throws(() => variantPricing({ priceCents: '123', servings: '0' }))
})
test('comparación usa precisión interna y marca todos los empates reales', () => {
  const rows = comparePresentations([{ id: 'a', priceCents: '1000', servings: '3' }, { id: 'b', priceCents: '999', servings: '3' }, { id: 'c', priceCents: '1998', servings: '6' }, { id: 'd', priceCents: '1000', servings: null }])
  assert.deepEqual(rows.map(r => r.isBest), [false, true, true, false])
  assert.equal(rows[0].savingPerServingCents, '0')
})
test('reparto de centavos por residuo e identificador estable; independiente del orden', () => {
  const weights = [{ id: 'b', weightCents: '1' }, { id: 'a', weightCents: '1' }, { id: 'c', weightCents: '1' }]
  assert.deepEqual(allocateCents('2', weights), [{ id: 'b', cents: '1' }, { id: 'a', cents: '1' }, { id: 'c', cents: '0' }])
  const reversed = allocateCents('2', [...weights].reverse()).sort((a, b) => a.id.localeCompare(b.id))
  assert.deepEqual(reversed, allocateCents('2', weights).sort((a, b) => a.id.localeCompare(b.id)))
  assert.throws(() => allocateCents('1', [{ id: 'a', weightCents: '0' }]))
  assert.throws(() => allocateCents('1', [{ id: 'a', weightCents: '1' }, { id: 'a', weightCents: '1' }]))
})
test('combos usan precios actuales y cantidades, sin asumir ahorro', () => {
  const result = bundlePricing('1000', [{ id: 'a', unitPriceCents: '500', quantity: 2 }, { id: 'b', unitPriceCents: '500', quantity: 1 }])
  assert.equal(result.referenceCents, '1500')
  assert.equal(result.savingCents, '500')
  assert.equal(result.components.reduce((sum, c) => sum + BigInt(c.cents), 0n), 1000n)
})
test('oferta no se descuenta dos veces: subtotal 1185 y ahorro de lista 70', () => {
  const result = calculateCart({ lines: [{ id: 'a', quantity: 1, unitPriceCents: '70000', compareAtPriceCents: '77000' }, { id: 'b', quantity: 1, unitPriceCents: '48500' }], shippingQuotedCents: '14900' })
  assert.equal(result.goodsBeforeCouponCents, '118500')
  assert.equal(result.listSavingCents, '7000')
  assert.equal(result.totalMoneyCents, '133400')
})
test('cupón antes de umbral de envío; puntos no cambian umbral ni cubren envío', () => {
  const input = { lines: [{ id: 'a', quantity: 1, unitPriceCents: '150000', couponEligible: true }], shippingQuotedCents: '10000', requestedPointsTenths: '1000', availablePointsTenths: '1000' }
  assert.equal(calculateCart(input).shippingChargedCents, '0')
  const discounted = calculateCart({ ...input, coupon: { kind: 'FIXED', amountCents: '200' } })
  assert.equal(discounted.shippingChargedCents, '10000')
  assert.equal(discounted.totalMoneyCents, '158800')
})
test('100% de productos con puntos, sumas exactas y cupones solo elegibles', () => {
  const result = calculateCart({ lines: [{ id: 'a', quantity: 1, unitPriceCents: '101', couponEligible: true }, { id: 'b', quantity: 1, unitPriceCents: '100', couponEligible: false }], coupon: { kind: 'PERCENT', basisPoints: 5000 }, requestedPointsTenths: '150', availablePointsTenths: '150', shippingQuotedCents: '100' })
  assert.equal(result.couponDiscountCents, '51')
  assert.equal(result.lines[1].couponCents, '0')
  assert.equal(result.goodsMoneyCents, '0')
  assert.equal(result.totalMoneyCents, '100')
  assert.equal(result.lines.reduce((sum, r) => sum + BigInt(r.moneyCents), 0n), 0n)
})
test('repartos mantienen sumas y no generan saldos negativos en muchas combinaciones', () => {
  for (let value = 1; value < 100; value++) {
    const subtotal = value * 3
    const result = calculateCart({ lines: [{ id: 'a', quantity: 1, unitPriceCents: String(value), couponEligible: true }, { id: 'b', quantity: 1, unitPriceCents: String(value * 2), couponEligible: true }], coupon: { kind: 'PERCENT', basisPoints: 3333 }, shippingQuotedCents: '0' })
    assert.equal(BigInt(result.goodsBeforeCouponCents), BigInt(subtotal))
    assert.equal(result.lines.reduce((sum, r) => sum + BigInt(r.couponCents), 0n), BigInt(result.couponDiscountCents))
    assert.equal(result.lines.reduce((sum, r) => sum + BigInt(r.moneyCents), 0n), BigInt(result.totalMoneyCents))
    assert.ok(result.lines.every(r => BigInt(r.moneyCents) >= 0n))
  }
})
