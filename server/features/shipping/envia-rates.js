import { postalCode } from '../../../shared/features/shipping/shipping-policy.js'

export class ShippingProviderError extends Error {}
const clean = (value, max = 250) => typeof value === 'string' && value.trim() && value.length <= max && !/[\x00-\x1f]/.test(value) ? value.trim() : null
export function rateAddress(input) {
  if (!input || input.country !== 'MX') throw new ShippingProviderError('La cotización requiere una dirección nacional válida.')
  const result = { country: 'MX', postalCode: postalCode(input.postalCode) }
  for (const field of ['name', 'phone', 'street', 'city', 'state']) {
    result[field] = clean(input[field])
    if (!result[field]) throw new ShippingProviderError('Completa nombre, teléfono, calle, ciudad y código estatal de Envia.com.')
  }
  if (!/^[A-Za-z]{2}$/.test(result.state)) throw new ShippingProviderError('Usa el código estatal de dos letras de Envia.com.')
  result.state = result.state.toUpperCase()
  return result
}
export function decimalRateCents(value) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof text !== 'string' || !/^\d{1,11}(?:\.\d{1,2})?$/.test(text)) throw new ShippingProviderError('El proveedor devolvió una tarifa inválida.')
  const [whole, fraction = ''] = text.split('.')
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString()
}
export function createEnviaRates({ token, environment = 'test', carrier, fetchImpl = fetch, timeoutMs = 8000 }) {
  if (!token || !['test', 'production'].includes(environment) || !/^[A-Za-z0-9_-]{1,60}$/.test(carrier ?? '')) throw new ShippingProviderError('Cotización no configurada. Intenta más tarde.')
  const url = environment === 'test' ? 'https://api-test.envia.com/ship/rate/' : 'https://api.envia.com/ship/rate/'
  return Object.freeze({
    async quote({ origin, destination, package: parcel, goodsCents, content }) {
      const originAddress = rateAddress(origin), destinationAddress = rateAddress(destination)
      if (![parcel?.grossWeightGrams, parcel?.lengthMm, parcel?.widthMm, parcel?.heightMm].every(n => Number.isInteger(n) && n > 0 && n <= 2147483647)) throw new ShippingProviderError('Paquete no válido para cotización.')
      if (!/^\d{1,13}$/.test(goodsCents)) throw new ShippingProviderError('Importe fuera de la capacidad de cotización.')
      const body = { origin: originAddress, destination: destinationAddress, packages: [{ type: 'box', content: clean(content) ?? 'Productos del carrito', amount: 1, declaredValue: Number(goodsCents) / 100, weight: parcel.grossWeightGrams / 1000, weightUnit: 'KG', lengthUnit: 'CM', dimensions: { length: parcel.lengthMm / 10, width: parcel.widthMm / 10, height: parcel.heightMm / 10 } }], shipment: { type: 1, carrier } }
      try {
        const response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok || !response.body) throw new Error('Respuesta inválida')
        const reader = response.body.getReader(), chunks = []
        let size = 0
        try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1048576) { await reader.cancel(); throw new Error('Respuesta excesiva') } chunks.push(value) } } finally { reader.releaseLock() }
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (data.meta === 'error' && data.error?.code === 1105 && data.error?.message === "Doesn't support more than 70kg for package unit") throw new ShippingProviderError('La paquetería reportó un límite de 70 kg para el paquete. Revisa el peso físico y volumétrico: pesos en gramos y medidas de la caja en milímetros.')
        if (data.meta === 'error' && data.error?.code === 1126) throw new ShippingProviderError('La paquetería configurada no pudo obtener una tarifa para este envío (Envia 1126). Intenta más tarde o solicita revisar la paquetería configurada. No es una confirmación de dirección incorrecta.')
        if (data.meta !== 'rate' || !Array.isArray(data.data) || data.data.length > 100) throw new Error('Formato inesperado')
        const seen = new Set()
        return data.data.map(rate => {
          if (rate.currency !== 'MXN' || rate.carrier !== carrier || typeof rate.service !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(rate.service)) throw new Error('Servicio inválido')
          const key = `${rate.carrier}:${rate.service}`
          if (seen.has(key)) throw new Error('Servicio duplicado')
          seen.add(key)
          return { carrierCode: rate.carrier, serviceCode: rate.service, serviceName: clean(rate.serviceDescription) ?? rate.service, quotedAmountCents: decimalRateCents(rate.totalPrice), currency: 'MXN', deliveryEstimate: clean(rate.deliveryEstimate) }
        })
      } catch (error) {
        if (error instanceof ShippingProviderError) throw error
        throw new ShippingProviderError('No pudimos cotizar el envío. Revisa dirección y vuelve a intentar.')
      }
    },
  })
}
