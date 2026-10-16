export function canSetQuantity(line) { return line.valid && line.maxQuantity > 0 }
export function limitedQuantity(line, value) {
  if (!canSetQuantity(line) || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return String(Math.max(1, Math.min(line.maxQuantity, Math.floor(number))))
}
export function stockMessage(line) {
  if (!line.valid) return 'Este producto ya no está disponible para comprar. Puedes quitarlo o guardarlo para después.'
  if (!line.availableQty) return 'Por el momento no hay existencias de esta presentación. Puedes quitarla o guardarla para después.'
  if (!line.maxQuantity) return 'Las existencias disponibles ya están incluidas en otras líneas o combos de tu carrito. Reduce esas cantidades para comprar esta presentación.'
  if (!line.stockSufficient) return `Tienes ${line.quantity} piezas en el carrito, pero el máximo disponible para esta línea es ${line.maxQuantity}. Revisa la cantidad y pulsa Actualizar.`
  return ''
}
export function stockChangeNotice(line) {
  if (!line.valid || !line.availableQty || !line.maxQuantity || !line.stockSufficient) return `${line.name}: ${stockMessage(line)}`
  return `Las existencias de ${line.name} cambiaron. Ahora hay ${line.availableQty} piezas disponibles; el máximo para esta línea es ${line.maxQuantity}.`
}
