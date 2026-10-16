import { AccountError, accountText } from '../accounts/credentials.js'
import { couponCode } from '../../../shared/features/coupons/coupon-eligibility.js'

export function couponInput(input) {
  const fail = message => { throw new AccountError(400, message) }
  if (!input || typeof input !== 'object') fail('Revisa los datos del cupón.')
  let codeNormalized
  try { codeNormalized = couponCode(input.code) } catch { fail('Código inválido: usa hasta 60 letras, números, guiones o guiones bajos.') }
  function amount(value, label, required = false) {
    if (value === '' || value == null) { if (required) fail(`${label} es obligatorio.`); return null }
    if (typeof value !== 'string' || !/^\d{1,15}$/.test(value) || BigInt(value) > 999999999999999n || (required && BigInt(value) === 0n)) fail(`${label} debe ser un importe válido en centavos.`)
    return BigInt(value)
  }
  function limit(value) {
    if (value === '' || value == null) return null
    if (!Number.isInteger(value) || value < 1 || value > 2147483647) fail('Los límites de uso deben ser números enteros positivos.')
    return value
  }
  function date(value) {
    if (value == null || value === '') return null
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Fecha del cupón inválida.')
    return new Date(value)
  }
  function ids(value) {
    if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || new Set(value).size !== value.length) fail('Selecciona hasta 100 elementos válidos sin repetir.')
    return value
  }
  if (!['FIXED', 'PERCENTAGE'].includes(input.kind)) fail('Selecciona el tipo de descuento.')
  if (!['CATALOG', 'PRODUCTS', 'CATEGORIES'].includes(input.scope)) fail('Selecciona dónde aplica el cupón.')
  for (const key of ['isActive', 'allowOffers', 'allowBundles']) if (typeof input[key] !== 'boolean') fail('Revisa las opciones del cupón.')
  const startsAt = date(input.startsAt), endsAt = date(input.endsAt)
  if (startsAt && endsAt && startsAt >= endsAt) fail('El fin debe ser posterior al inicio.')
  const productIds = ids(input.productIds ?? []), categoryIds = ids(input.categoryIds ?? [])
  if (input.scope === 'PRODUCTS' && !productIds.length || input.scope === 'CATEGORIES' && !categoryIds.length) fail('Selecciona al menos un elemento para el alcance del cupón.')
  if (input.kind === 'PERCENTAGE' && (!Number.isInteger(input.percentageBasisPoints) || input.percentageBasisPoints < 1 || input.percentageBasisPoints > 10000)) fail('El porcentaje debe estar entre 0.01 y 100 %.')
  return {
    data: { code: input.code.trim(), codeNormalized, kind: input.kind, fixedAmountCents: input.kind === 'FIXED' ? amount(input.fixedAmountCents, 'Descuento', true) : null, percentageBasisPoints: input.kind === 'PERCENTAGE' ? input.percentageBasisPoints : null, minimumEligibleCents: amount(input.minimumEligibleCents, 'Compra mínima'), startsAt, endsAt, maxUses: limit(input.maxUses), maxUsesPerCustomer: limit(input.maxUsesPerCustomer), scope: input.scope, isActive: input.isActive, allowOffers: input.allowOffers, allowBundles: input.allowBundles },
    productIds: input.scope === 'PRODUCTS' ? productIds : [], categoryIds: input.scope === 'CATEGORIES' ? categoryIds : [], reason: accountText(input.reason, 'Motivo', 500),
  }
}
