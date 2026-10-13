export function imagesForVariant(images, variantId) {
  if (!variantId) return []
  const own = images.filter(image => image.variantId === variantId)
  return images.filter(image => image.variantId === variantId || image.variantId == null && (image.kind === 'GALLERY' || !own.some(specific => specific.kind === image.kind)))
}
