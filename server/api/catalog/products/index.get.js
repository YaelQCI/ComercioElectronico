import { readCatalog } from '../../../features/catalog/catalog-http.js'
import { parseCatalogFilters } from '../../../../shared/features/catalog/filters.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  let filters
  try { filters = parseCatalogFilters(getQuery(event)) } catch { throw createError({ statusCode: 400, statusMessage: 'Consulta o filtros inválidos.' }) }
  return readCatalog(repository => repository.browse(filters))
})
