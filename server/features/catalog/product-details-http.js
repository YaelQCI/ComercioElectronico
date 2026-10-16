import { Readable } from 'node:stream'
import { resolve } from 'node:path'
import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { createProductDetailsAdministration } from './manage-product-details.js'
import { createLotTraceabilityAdministration, createCertificateStorage, maxCertificateBytes } from '../inventory/manage-lot-traceability.js'
import { createCatalogRepository } from './catalog-repository.js'
import { readCertificate } from './read-certificate.js'

const storage = event => createCertificateStorage(useRuntimeConfig(event).catalogUploadDirectory || resolve(process.cwd(), '.catalog-uploads'))
export async function productDetailsRequest(event, action) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (action !== 'options') requireCartOrigin(event)
  try {
    const identity = await accountIdentity(event), db = getDatabase(), service = createProductDetailsAdministration(db)
    if (action === 'options') return await service.options(identity.user.id, getQuery(event).q ?? '')
    if (action === 'brand') return await service.createBrand(identity.user.id, await readBody(event))
    if (action === 'variant') return await service.createVariant(identity.user.id, getRouterParam(event, 'id'), await readBody(event))
    return await createLotTraceabilityAdministration(db, storage(event)).save(identity.user.id, getRouterParam(event, 'id'), await readBody(event))
  } catch (error) { throw createError({ statusCode: error instanceof AccountError ? error.status : error.code === 'P2002' ? 409 : 503, statusMessage: error instanceof AccountError ? error.message : error.code === 'P2002' ? 'Ya existe ese SKU, combinación de sabor y presentación, o identificador de marca.' : 'No pudimos guardar o consultar estos datos.' }) }
}
export async function uploadLotCertificate(event) {
  requireCartOrigin(event)
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    const identity = await accountIdentity(event), db = getDatabase()
    await db.$transaction(tx => requireAdministrator(tx, identity.user.id))
    const contentType = getHeader(event, 'content-type')
    if (!contentType?.startsWith('multipart/form-data;')) throw new AccountError(415, 'Utiliza el formulario para cargar el certificado.')
    if (Number(getHeader(event, 'content-length')) > maxCertificateBytes + 65536) throw new AccountError(413, 'La carga supera 20 MB.')
    const reader = Readable.toWeb(event.node.req).getReader(), chunks = []
    let length = 0
    try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > maxCertificateBytes + 65536) throw new AccountError(413, 'La carga supera 20 MB.'); chunks.push(value) } }
    catch (error) { await reader.cancel().catch(() => {}); throw error } finally { reader.releaseLock() }
    let form
    try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': contentType } }).formData() } catch { throw new AccountError(400, 'Formulario de certificado inválido.') }
    const file = form.get('certificate')
    if (form.getAll('certificate').length !== 1 || !file || typeof file.arrayBuffer !== 'function') throw new AccountError(400, 'Selecciona un certificado PDF.')
    const input = Object.fromEntries(['origin', 'customsEntry', 'importedOn', 'reason'].map(key => [key, form.get(key)]))
    input.expectedVersion = Number(form.get('expectedVersion'))
    return await createLotTraceabilityAdministration(db, storage(event)).save(identity.user.id, getRouterParam(event, 'id'), input, { bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type })
  } catch (error) { throw createError({ statusCode: error instanceof AccountError ? error.status : 503, statusMessage: error instanceof AccountError ? error.message : 'No pudimos guardar el certificado.' }) }
}
export async function readLotCertificate(event) {
  const id = getRouterParam(event, 'id')
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Lote inválido.' })
  const db = getDatabase()
  let asset = await createCatalogRepository(db).certificateForLot(id)
  if (!asset) {
    const identity = await accountIdentity(event, false)
    if (identity?.user.role === 'ADMIN') asset = await db.$transaction(async tx => { await requireAdministrator(tx, identity.user.id); return (await tx.inventoryLot.findUnique({ where: { id }, include: { certificateAsset: true } }))?.certificateAsset })
  }
  const config = useRuntimeConfig(event)
  const bytes = asset?.storageKey.startsWith('uploaded-certificates/') ? await storage(event).read(asset) : await readCertificate(asset, config.catalogAssetDirectory || resolve(process.cwd(), import.meta.dev ? 'public' : '.output/public'))
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'Certificado no disponible.' })
  setHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="certificado-${id}.pdf"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': 'sandbox' })
  return bytes
}
