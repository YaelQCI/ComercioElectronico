import { readCatalog } from '../../features/catalog/catalog-http.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  return readCatalog(repository => repository.home())
})
