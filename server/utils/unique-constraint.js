// Prisma puede informar columnas o el nombre del índice a través del adaptador pg.
// No se interpreta ni se muestra el mensaje SQL del proveedor.
export function uniqueConstraintMatches(error, fields, index) {
  if (error?.code !== 'P2002') return false
  const sameFields = value => Array.isArray(value) && value.length === fields.length && fields.every(field => value.includes(field))
  return [error.meta?.target, error.meta?.constraint, error.meta?.driverAdapterError?.cause?.constraint].some(target =>
    typeof target === 'string' ? target === index : sameFields(target) || target?.index === index || sameFields(target?.fields)
  )
}
