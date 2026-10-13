export function selectedVariant(product, variantId) {
  if (!product?.variants?.length) return null
  if (variantId == null || variantId === '') return product.variants[0]
  return typeof variantId === 'string' ? product.variants.find(v => v.id === variantId) ?? null : null
}
export function productQuantity(value, availableQty, alreadyInCart = 0) {
  if (!Number.isSafeInteger(availableQty) || !Number.isSafeInteger(alreadyInCart) || alreadyInCart < 0 || availableQty < 0) throw new RangeError('Disponibilidad inválida.')
  const quantity = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > availableQty - alreadyInCart) throw new RangeError('Usa una cantidad entera entre 1 y las piezas disponibles.')
  return quantity
}
export function nutritionRows(data) {
  // Only the documented row format is rendered; no nutritional claims inferred.
  if (!data || !Array.isArray(data.rows)) return []
  return data.rows.filter(row => row && typeof row.name === 'string' && typeof row.amount === 'string' && typeof row.unit === 'string').map((row, id) => ({ id: String(id), nutrient: row.name, amount: `${row.amount} ${row.unit}`.trim() }))
}
