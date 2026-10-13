export class PackingError extends Error {}
const positive = value => Number.isInteger(value) && value > 0 && value <= 2147483647
const volume = dimensions => dimensions.reduce((v, n) => v * BigInt(n), 1n)
function orientations([a, b, c]) {
  return [...new Map([[a,b,c], [a,c,b], [b,a,c], [b,c,a], [c,a,b], [c,b,a]].map(d => [d.join(','), d])).values()]
}
function fit(items, box) {
  const spaces = [{ position: [0,0,0], dimensions: [box.innerLengthMm, box.innerWidthMm, box.innerHeightMm] }]
  const placements = []
  for (const item of items) {
    let remaining = item.quantity
    while (remaining) {
      let best = null
      for (let index = 0; index < spaces.length; index++) for (const orientation of orientations(item.dimensions)) {
        const capacity = spaces[index].dimensions.map((d, i) => Math.floor(d / orientation[i]))
        if (capacity.some(n => !n)) continue
        const possible = volume(capacity), quantity = Number(possible < BigInt(remaining) ? possible : BigInt(remaining))
        const grid = [Math.min(capacity[0], quantity), 1, 1]
        grid[1] = Math.min(capacity[1], Math.ceil(quantity / grid[0]))
        grid[2] = Math.ceil(quantity / (grid[0] * grid[1]))
        const dimensions = grid.map((n, i) => n * orientation[i])
        const waste = volume(spaces[index].dimensions) - volume(dimensions)
        if (!best || quantity > best.quantity || (quantity === best.quantity && waste < best.waste)) best = { index, quantity, orientation, grid, dimensions, waste }
      }
      if (!best) return null
      const space = spaces.splice(best.index, 1)[0], [x,y,z] = space.position, [l,w,h] = space.dimensions, [a,b,c] = best.dimensions
      placements.push({ variantId: item.variantId, quantity: best.quantity, positionMm: [x,y,z], unitDimensionsMm: best.orientation, grid: best.grid })
      // Three disjoint remaining cuboids. Unused cells of the last grid stay reserved.
      if (l > a) spaces.push({ position: [x+a,y,z], dimensions: [l-a,w,h] })
      if (w > b) spaces.push({ position: [x,y+b,z], dimensions: [a,w-b,h] })
      if (h > c) spaces.push({ position: [x,y,z+c], dimensions: [a,b,h-c] })
      remaining -= best.quantity
    }
  }
  return placements
}
export function choosePackage(input, boxes) {
  if (!Array.isArray(input) || !input.length || !Array.isArray(boxes)) throw new PackingError('Faltan artículos o cajas configuradas.')
  const grouped = new Map()
  for (const item of input) {
    if (typeof item.variantId !== 'string' || !item.variantId || ![item.quantity, item.weightGrams, item.lengthMm, item.widthMm, item.heightMm].every(positive)) throw new PackingError('Faltan pesos, medidas o cantidades válidas.')
    const dimensions = [item.lengthMm, item.widthMm, item.heightMm]
    const existing = grouped.get(item.variantId)
    if (existing && (existing.weightGrams !== item.weightGrams || existing.dimensions.join(',') !== dimensions.join(','))) throw new PackingError('Medidas inconsistentes para la misma variante.')
    const quantity = item.quantity + (existing?.quantity ?? 0)
    if (!positive(quantity)) throw new PackingError('Cantidad fuera de la capacidad técnica del inventario.')
    grouped.set(item.variantId, { variantId: item.variantId, quantity, weightGrams: item.weightGrams, dimensions })
  }
  const items = [...grouped.values()].sort((a,b) => { const va = volume(a.dimensions), vb = volume(b.dimensions); return va === vb ? a.variantId.localeCompare(b.variantId) : va > vb ? -1 : 1 })
  const netWeight = items.reduce((sum, item) => sum + BigInt(item.weightGrams) * BigInt(item.quantity), 0n)
  const candidates = boxes.filter(box => box.isActive && [box.innerLengthMm, box.innerWidthMm, box.innerHeightMm, box.outerLengthMm, box.outerWidthMm, box.outerHeightMm].every(positive) && box.outerLengthMm >= box.innerLengthMm && box.outerWidthMm >= box.innerWidthMm && box.outerHeightMm >= box.innerHeightMm && Number.isInteger(box.tareWeightGrams) && box.tareWeightGrams >= 0 && box.tareWeightGrams <= 2147483647 && (box.maxGrossWeightGrams == null || positive(box.maxGrossWeightGrams))).sort((a,b) => { const va = volume([a.outerLengthMm,a.outerWidthMm,a.outerHeightMm]), vb = volume([b.outerLengthMm,b.outerWidthMm,b.outerHeightMm]); return va === vb ? String(a.id).localeCompare(String(b.id)) : va < vb ? -1 : 1 })
  for (const box of candidates) {
    const gross = netWeight + BigInt(box.tareWeightGrams)
    if (gross > 2147483647n || (box.maxGrossWeightGrams != null && gross > BigInt(box.maxGrossWeightGrams))) continue
    const placements = fit(items, box)
    if (placements) return { packageTypeId: box.id, packageCode: box.code, packageVersion: box.version, netWeightGrams: Number(netWeight), tareWeightGrams: box.tareWeightGrams, grossWeightGrams: Number(gross), lengthMm: box.outerLengthMm, widthMm: box.outerWidthMm, heightMm: box.outerHeightMm, placements }
  }
  throw new PackingError('No se pudo comprobar una caja apta para todo el pedido. Revisa artículos o configuración de empaque.')
}
