import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdtemp, rmdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareProductImage, createImageStorage, maxProductImageBytes } from '../../server/features/catalog/uploaded-images.js'

test('decodifica imágenes admitidas, limita dimensiones y guarda WebP', async () => {
  for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
    const original = await sharp({ create: { width: 2100, height: 100, channels: 3, background: '#fff' } })[format]().toBuffer()
    const output = await prepareProductImage(original, mime), metadata = await sharp(output).metadata()
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 2000)
  }
})

test('rechaza SVG, contenido disfrazado, imagen dañada y exceso de tamaño o píxeles', async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer()
  await assert.rejects(prepareProductImage(Buffer.from('<svg/>'), 'image/svg+xml'), e => e.status === 415)
  await assert.rejects(prepareProductImage(png, 'image/jpeg'), e => e.status === 400)
  await assert.rejects(prepareProductImage(Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'), e => e.status === 400)
  await assert.rejects(prepareProductImage(Buffer.alloc(maxProductImageBytes+1), 'image/png'), e => e.status === 413)
  const huge = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer()
  await assert.rejects(prepareProductImage(huge, 'image/png'), e => e.status === 400)
})

test('almacenamiento usa nombres propios, verifica integridad y rechaza rutas ajenas', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fitness-image-test-')), storage = createImageStorage(root)
  let key
  try {
    const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).webp().toBuffer()
    key = await storage.write(bytes)
    const asset = { storageKey: key, mimeType: 'image/webp', byteSize: BigInt(bytes.length), checksum: createHash('sha256').update(bytes).digest('hex') }
    assert.deepEqual(await storage.read(asset), bytes)
    assert.equal(await storage.read({ ...asset, storageKey: '../secreto' }), null)
    await writeFile(join(root, key.slice('uploads/'.length)), Buffer.alloc(bytes.length))
    assert.equal(await storage.read(asset), null)
  } finally { if (key) await storage.remove(key); await rmdir(root) }
})
