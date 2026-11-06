import test from 'node:test'
import assert from 'node:assert/strict'
import { couponInput } from '../../server/features/coupons/coupon-input.js'
const input = { code: ' VERANO_10 ', kind: 'PERCENTAGE', percentageBasisPoints: 1000, scope: 'CATALOG', isActive: true, allowOffers: false, allowBundles: false, reason: 'Campaña de prueba' }
test('normaliza códigos y conserva precisión monetaria y porcentajes', () => {
  assert.equal(couponInput(input).data.codeNormalized, 'verano_10')
  assert.equal(couponInput(input).data.percentageBasisPoints, 1000)
  assert.equal(couponInput(input).data.freeShipping, false)
  assert.equal(couponInput({ ...input, freeShipping: true }).data.freeShipping, true)
  for (const freeShipping of ['true', 1, null]) assert.throws(() => couponInput({ ...input, freeShipping }), error => error.status === 400)
  const fixed = couponInput({ ...input, kind: 'FIXED', fixedAmountCents: '999999999999999', minimumEligibleCents: '12345' }).data
  assert.equal(fixed.fixedAmountCents, 999999999999999n)
  assert.equal(fixed.minimumEligibleCents, 12345n)
  assert.equal(fixed.percentageBasisPoints, null)
})
test('rechaza importes, límites, banderas, fechas y alcances inválidos', () => {
  for (const patch of [{ code: 'con espacio' }, { percentageBasisPoints: 10001 }, { percentageBasisPoints: 1.5 }, { kind: 'FIXED', fixedAmountCents: '0' }, { minimumEligibleCents: '-1' }, { maxUses: 0 }, { maxUsesPerCustomer: '3' }, { allowOffers: 'false' }, { startsAt: '2026-02-30T00:00:00.000Z' }, { startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z' }, { scope: 'PRODUCTS', productIds: [] }, { scope: 'CATEGORIES', categoryIds: ['bad'] }, { reason: '' }]) assert.throws(() => couponInput({ ...input, ...patch }), error => error.status === 400)
})

test('límite por cliente no puede superar el global; vacío conserva ausencia de límite', () => {
  assert.throws(() => couponInput({ ...input, maxUses: 5, maxUsesPerCustomer: 6 }), error => error.status === 400 && /no pueden superar el límite global/.test(error.message))
  for (const [maxUses, maxUsesPerCustomer] of [[5, 5], [5, 1], [null, 10], [10, null], [null, null]]) {
    const result = couponInput({ ...input, maxUses, maxUsesPerCustomer }).data
    assert.equal(result.maxUses, maxUses)
    assert.equal(result.maxUsesPerCustomer, maxUsesPerCustomer)
  }
})
