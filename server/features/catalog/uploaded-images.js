import sharp from 'sharp'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'

export const maxProductImageBytes = 5 * 1024 * 1024
export async function prepareProductImage(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > maxProductImageBytes) throw new AccountError(413, 'La imagen debe pesar entre 1 byte y 5 MB.')
  const formats = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }
  if (!formats[mimeType]) throw new AccountError(415, 'Selecciona una imagen JPG, PNG o WebP.')
  try {
    const pipeline = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' })
    const metadata = await pipeline.metadata()
    if (metadata.format !== formats[mimeType] || (metadata.pages ?? 1) > 1) throw Error('Formato no válido')
    const output = await pipeline.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer()
    if (output.length > maxProductImageBytes) throw Error('Salida demasiado grande')
    return output
  } catch { throw new AccountError(400, 'La imagen está dañada, animada, es demasiado grande o no coincide con su formato.') }
}

export function createImageStorage(directory) {
  const root = resolve(directory)
  const filePath = key => {
    if (!/^uploads\/[0-9a-f-]{36}\.webp$/.test(key)) throw new AccountError(400, 'Recurso de imagen inválido.')
    return resolve(root, key.slice('uploads/'.length))
  }
  return {
    async write(bytes) {
      await mkdir(root, { recursive: true })
      const key = `uploads/${randomUUID()}.webp`
      await writeFile(filePath(key), bytes, { flag: 'wx', mode: 0o600 })
      return key
    },
    async remove(key) { await unlink(filePath(key)) },
    async read(asset) {
      if (asset.mimeType !== 'image/webp' || asset.byteSize > BigInt(maxProductImageBytes)) return null
      try {
        const info = await stat(filePath(asset.storageKey))
        if (!info.isFile() || BigInt(info.size) !== BigInt(asset.byteSize)) return null
        const bytes = await readFile(filePath(asset.storageKey))
        if (BigInt(bytes.length) !== BigInt(asset.byteSize) || createHash('sha256').update(bytes).digest('hex') !== asset.checksum) return null
        return bytes
      } catch { return null }
    },
  }
}

export function createProductImages(db, storage) {
  return {
    async add(adminId, productId, input) {
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(productId ?? '')) throw new AccountError(400, 'Producto inválido.')
      const altText = accountText(input?.alt, 'Descripción de imagen', 500), reason = accountText(input?.reason, 'Motivo', 500)
      if (!['FRONT', 'NUTRITION', 'GALLERY'].includes(input?.kind)) throw new AccountError(400, 'Tipo de imagen inválido.')
      let storedKey
      try {
        return await db.$transaction(async tx => {
          await requireAdministrator(tx, adminId)
          await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`
          const product = await tx.product.findUnique({ where: { id: productId } })
          if (!product || product.deletedAt) throw new AccountError(404, 'Producto no disponible para cargar imágenes.')
          const variantId = input.variantId || null
          if (variantId !== null && (typeof variantId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(variantId) || !await tx.productVariant.findFirst({ where: { id: variantId, productId, deletedAt: null } }))) throw new AccountError(400, 'Presentación no disponible para esa imagen.')
          if (await tx.productMedia.count({ where: { productId } }) >= 20) throw new AccountError(409, 'El producto ya tiene el máximo de 20 imágenes.')
          const bytes = await prepareProductImage(input.bytes, input.mimeType)
          storedKey = await storage.write(bytes)
          const asset = await tx.mediaAsset.create({ data: { storageKey: storedKey, mimeType: 'image/webp', byteSize: BigInt(bytes.length), checksum: createHash('sha256').update(bytes).digest('hex'), createdById: adminId } })
          if (input.kind !== 'GALLERY') await tx.productMedia.updateMany({ where: { productId, variantId, kind: input.kind }, data: { kind: 'GALLERY' } })
          const last = await tx.productMedia.aggregate({ where: { productId }, _max: { position: true } })
          const media = await tx.productMedia.create({ data: { productId, variantId, assetId: asset.id, kind: input.kind, altText, position: (last._max.position ?? -1)+1 } })
          await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', entityType: 'Product', entityId: productId, action: 'UPLOAD_PRODUCT_IMAGE', reason, safeAfter: { mediaId: media.id, variantId, kind: media.kind, checksum: asset.checksum }, correlationId: randomUUID() } })
          return { id: media.id, url: `/api/catalog/images/${asset.id}`, kind: media.kind, alt: altText }
        }, { timeout: 30000 })
      } catch (error) {
        if (storedKey) await storage.remove(storedKey).catch(() => {})
        throw error
      }
    },
  }
}
