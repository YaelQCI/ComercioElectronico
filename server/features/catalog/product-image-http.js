import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { createImageStorage, createProductImages, maxProductImageBytes } from './uploaded-images.js'
import { createCatalogRepository } from './catalog-repository.js'

const imageStorage = event => createImageStorage(useRuntimeConfig(event).catalogUploadDirectory || resolve(process.cwd(), '.catalog-uploads'))
export async function readImageUpload(stream, contentType) {
  if (!contentType?.startsWith('multipart/form-data;')) throw new AccountError(415, 'Envía la imagen mediante el formulario de carga.')
  const reader = stream.getReader(), chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxProductImageBytes+65536) throw new AccountError(413, 'La carga supera el límite de 5 MB.')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  let form
  try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': contentType } }).formData() }
  catch { throw new AccountError(400, 'Formulario de imagen inválido.') }
  const file = form.get('image')
  if (form.getAll('image').length !== 1 || !file || typeof file.arrayBuffer !== 'function') throw new AccountError(400, 'Selecciona una imagen.')
  return { bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type, alt: form.get('alt'), kind: form.get('kind'), reason: form.get('reason'), variantId: form.get('variantId') }
}
export async function uploadProductImage(event) {
  setHeader(event, 'Cache-Control', 'no-store')
  requireCartOrigin(event)
  try {
    const identity = await accountIdentity(event), db = getDatabase()
    await db.$transaction(tx => requireAdministrator(tx, identity.user.id))
    const length = Number(getHeader(event, 'content-length'))
    if (length > maxProductImageBytes+65536) throw new AccountError(413, 'La carga supera el límite de 5 MB.')
    const input = await readImageUpload(Readable.toWeb(event.node.req), getHeader(event, 'content-type'))
    return await createProductImages(db, imageStorage(event)).add(identity.user.id, getRouterParam(event, 'id'), input)
  } catch (error) {
    throw createError({ statusCode: error instanceof AccountError ? error.status : 503, statusMessage: error instanceof AccountError ? error.message : 'No pudimos guardar la imagen. Intenta de nuevo.' })
  }
}
export async function readProductImage(event) {
  const id = getRouterParam(event, 'id')
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id ?? '')) throw createError({ statusCode: 404, statusMessage: 'Imagen no disponible.' })
  const db = getDatabase()
  let asset = await createCatalogRepository(db).imageAsset(id)
  if (!asset) {
    const identity = await accountIdentity(event, false)
    if (identity?.user.role === 'ADMIN') asset = await db.$transaction(async tx => {
      await requireAdministrator(tx, identity.user.id)
      return tx.mediaAsset.findFirst({ where: { id, productMedia_asset: { some: {} } } })
    })
  }
  const bytes = asset ? await imageStorage(event).read(asset) : null
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'Imagen no disponible.' })
  setHeaders(event, { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline' })
  return bytes
}
