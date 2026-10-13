import { readCatalog } from '../../../features/catalog/catalog-http.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  return { products: await readCatalog(repository => repository.list()) }
})
