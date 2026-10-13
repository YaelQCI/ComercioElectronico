import { resolve } from 'node:path'
import { readCatalog } from '../../../../features/catalog/catalog-http.js'
import { readCertificate } from '../../../../features/catalog/read-certificate.js'
export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id')
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Lote inválido.' })
  const asset = await readCatalog(repository => repository.certificateForLot(id))
  const directory = useRuntimeConfig().catalogAssetDirectory || resolve(process.cwd(), import.meta.dev ? 'public' : '.output/public')
  const bytes = await readCertificate(asset, directory)
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'Certificado no disponible.' })
  setHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="certificado-${id}.pdf"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
  return bytes
})
