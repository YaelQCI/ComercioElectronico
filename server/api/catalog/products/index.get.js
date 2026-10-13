import { readCatalog } from '../../../features/catalog/catalog-http.js'
import { parseCatalogFilters } from '../../../../shared/features/catalog/filters.js'
import { parseCatalogPage } from '../../../../shared/features/catalog/pagination.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  let filters, pagination
  try { const query = getQuery(event); filters = parseCatalogFilters(query); pagination = parseCatalogPage(query) } catch { throw createError({ statusCode: 400, statusMessage: 'Consulta, filtros u orden inválidos.' }) }
  return readCatalog(repository => repository.browse(filters, pagination))
})
