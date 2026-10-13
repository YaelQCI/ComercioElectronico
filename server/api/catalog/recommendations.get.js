import { readCatalog } from '../../features/catalog/catalog-http.js'
export default defineEventHandler(event => {
  const query = getQuery(event)
  const parseIds = value => {
    if (value == null || value === '') return []
    if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: 'Identificadores inválidos.' })
    const ids = [...new Set(value.split(','))]
    if (ids.length > 100 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw createError({ statusCode: 400, statusMessage: 'Identificadores inválidos.' })
    return ids
  }
  const source = parseIds(query.source), excluded = parseIds(query.exclude)
  if (!['RELATED', 'CROSS_SELL'].includes(query.kind)) throw createError({ statusCode: 400, statusMessage: 'Tipo de relación inválido.' })
  return readCatalog(async repo => ({ products: await repo.recommendations(source, query.kind, excluded) }))
})
