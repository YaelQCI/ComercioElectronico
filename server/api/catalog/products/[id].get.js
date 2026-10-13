import { readCatalog } from '../../../features/catalog/catalog-http.js'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const id = getRouterParam(event, 'id')
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })
  const product = await readCatalog(repository => repository.getById(id))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Producto no disponible.' })
  return { product }
})
