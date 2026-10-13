import { realpath, readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'

export async function readCertificate(asset, rootPath) {
  if (!asset || asset.mimeType !== 'application/pdf' || !/^\/certificates\/[a-zA-Z0-9/_-]+\.pdf$/.test(asset.storageKey)) return null
  try {
    const root = await realpath(rootPath), target = await realpath(resolve(root, asset.storageKey.slice(1)))
    if (!target.startsWith(`${root}${sep}`)) return null
    const file = await stat(target)
    if (!file.isFile() || file.size > 20 * 1024 * 1024 || BigInt(file.size) !== BigInt(asset.byteSize)) return null
    const bytes = await readFile(target)
    if (bytes.length > 20 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-' || BigInt(bytes.length) !== BigInt(asset.byteSize) || createHash('sha256').update(bytes).digest('hex') !== asset.checksum) return null
    return bytes
  } catch { return null }
}
