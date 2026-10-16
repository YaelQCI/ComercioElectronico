const confirmedStates = new Set(['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'])
export const orderStatusLabels = { PENDING_PAYMENT: 'Pendiente de pago', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELED: 'Cancelado' }
export const moneyStatusLabels = { PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'No completado', NOT_REQUIRED: 'Sin cobro requerido', RECONCILING: 'En revisión', PARTIALLY_REFUNDED: 'Reembolso parcial', REFUNDED: 'Reembolsado' }
export function paymentPresentation(data) {
  if (!data) return { kind: 'pending', title: 'Estamos consultando tu compra', description: 'En un momento te mostraremos el estado de tu pedido.' }
  if (confirmedStates.has(data.status) && ['PAID', 'NOT_REQUIRED'].includes(data.moneyStatus)) return {
    kind: 'success', title: '¡Gracias por tu compra!',
    description: data.moneyStatus === 'PAID' ? 'Tu pago fue verificado y tu pedido está confirmado. Conserva tu número de pedido para consultar su avance.' : 'Tu pedido está confirmado. No fue necesario realizar un cobro.',
  }
  if (['PARTIALLY_REFUNDED', 'REFUNDED'].includes(data.moneyStatus)) return { kind: 'refund', title: data.moneyStatus === 'REFUNDED' ? 'Tu pago fue reembolsado' : 'Tu pedido tiene un reembolso parcial', description: 'Aquí puedes consultar el estado registrado de tu compra.' }
  if (data.status === 'CANCELED') return { kind: 'neutral', title: 'Tu pedido está cancelado', description: 'Consulta el estado del pago para conocer si corresponde un reembolso.' }
  if (data.moneyStatus === 'RECONCILING' || data.needsReview || data.moneyStatus === 'PAID') return { kind: 'review', title: 'Estamos revisando tu pago', description: 'Estamos comprobando el resultado. Evita realizar otra compra para pagar este mismo pedido.' }
  if (data.moneyStatus === 'FAILED' || data.cardRejected) return { kind: 'warning', title: 'El pago no se completó', description: 'Puedes revisar tu intento y volver a pagar cuando esté disponible.' }
  return { kind: 'pending', title: 'Tu pago está pendiente', description: 'Si ya pagaste, espera la confirmación. El estado se actualizará al volver a esta pestaña.' }
}
