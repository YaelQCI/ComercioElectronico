// Cada límite se valida por separado; aquí se comprueba la relación entre ambos.
export function couponUsageLimitsError(maxUses, maxUsesPerCustomer) {
  if (!Number.isInteger(maxUses) || !Number.isInteger(maxUsesPerCustomer)) return ''
  return maxUsesPerCustomer > maxUses ? 'Usos por cliente: no pueden superar el límite global de usos. Reduce el límite por cliente o aumenta el global.' : ''
}
