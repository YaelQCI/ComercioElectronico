import { AccountError, accountText } from '../accounts/credentials.js'
import { parseServings } from '../../../shared/features/catalog/servings.js'
const cents = value => { if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(value)) throw new AccountError(400, 'Precio inválido; utiliza centavos como texto.'); return BigInt(value) }
export function variantData(input) {
  const data = {}
  for (const key of ['sku', 'flavor', 'presentationLabel', 'contentUnit']) data[key] = accountText(input?.[key], key, 120)
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(data.sku)) throw new AccountError(400, 'SKU inválido.')
  data.flavorNormalized = data.flavor.toLowerCase(); data.presentationNormalized = data.presentationLabel.toLowerCase()
  if (typeof input.contentAmount !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(input.contentAmount) || Number(input.contentAmount) <= 0) throw new AccountError(400, 'Contenido inválido.')
  data.contentAmount = input.contentAmount; data.priceCents = cents(input.priceCents)
  try { data.servings = parseServings(input.servings) } catch (error) { throw new AccountError(400, error.message) }
  for (const key of ['weightGrams', 'lengthMm', 'widthMm', 'heightMm']) { if (!Number.isInteger(input[key]) || input[key] < 1 || input[key] > 2147483647) throw new AccountError(400, 'Medidas inválidas.'); data[key] = input[key] }
  return data
}
