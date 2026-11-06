import { uniqueConstraintMatches } from '../../utils/unique-constraint.js'

export function catalogDuplicateMessage(error, entity = 'product') {
  if (entity === 'category' && uniqueConstraintMatches(error, ['slug'], 'Category_slug_key')) return 'Identificador de URL de la categoría: ya está registrado. Usa otro identificador o edita la categoría existente.'
  if (entity === 'brand' && uniqueConstraintMatches(error, ['slug'], 'Brand_slug_key')) return 'Identificador de marca: ya está registrado. Selecciona la marca existente o usa otro identificador.'
  if (entity === 'product' && uniqueConstraintMatches(error, ['slug'], 'Product_slug_key')) return 'Identificador de URL del producto: ya está registrado. Usa otro identificador o edita el producto existente.'
  if (uniqueConstraintMatches(error, ['sku'], 'ProductVariant_sku_key')) return 'SKU: ya está registrado en otra presentación, aunque esté desactivada. Usa otro SKU o edita la presentación existente.'
  if (uniqueConstraintMatches(error, ['productId', 'flavorNormalized', 'presentationNormalized'], 'ProductVariant_productId_flavorNormalized_presentationNorma_key')) return 'Sabor y presentación: esa combinación ya existe en este producto, aunque esté desactivada. Edita la presentación existente o usa una combinación distinta.'
  return 'El registro entra en conflicto con otro que ya existe. Actualiza la lista y revisa sus identificadores antes de volver a guardar.'
}
