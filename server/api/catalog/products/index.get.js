import { readCatalog } from '../../../features/catalog/catalog-http.js'
import { searchQuery } from '../../../../shared/features/catalog/search.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  let q
  try { q = searchQuery(getQuery(event).q) } catch { throw createError({ statusCode: 400, statusMessage: 'Consulta inválida: máximo 120 caracteres.' }) }
  return { products: await readCatalog(repository => repository.list({ q })) }
})
