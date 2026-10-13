import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { sellableLots, expiryLabel } from '../../shared/features/inventory/lots.js'
import { readCertificate } from '../../server/features/catalog/read-certificate.js'
test('FEFO descarta vencidos, bloqueados y reservados; no caducan al final y desempate estable', () => {
  const now = new Date('2026-10-13T18:00:00Z')
  const base = { onHandQty: 3, reservedQty: 1, isBlocked: false, expiresOn: '2027-01-31', warehouse: { timezone: 'America/Mexico_City' }, createdAt: '2026-01-01' }
  const lots = [{ ...base, id: 'b' }, { ...base, id: 'a' }, { ...base, id: 'c', expiresOn: null }, { ...base, id: 'd', expiresOn: '2026-10-12' }, { ...base, id: 'e', isBlocked: true }, { ...base, id: 'f', reservedQty: 3 }]
  assert.deepEqual(sellableLots(lots, now).map(l => l.id), ['a', 'b', 'c'])
  assert.equal(expiryLabel({ expiresOn: '2027-01-31', expiryPrecision: 'MONTH' }), '01/2027')
  assert.equal(expiryLabel({ expiresOn: '2027-01-31', expiryPrecision: 'DAY' }), '31/01/2027')
})
test('certificado valida existencia, ruta, firma/hash y nunca devuelve archivo alterado', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fitness-certificate-test-'))
  try {
    await mkdir(join(root, 'certificates'))
    const bytes = Buffer.from('%PDF-fixture-only-not-a-commercial-certificate')
    await writeFile(join(root, 'certificates', 'fixture.pdf'), bytes)
    const asset = { mimeType: 'application/pdf', storageKey: '/certificates/fixture.pdf', byteSize: String(bytes.length), checksum: createHash('sha256').update(bytes).digest('hex') }
    assert.deepEqual(await readCertificate(asset, root), bytes)
    assert.equal(await readCertificate({ ...asset, storageKey: '/certificates/missing.pdf' }, root), null)
    assert.equal(await readCertificate({ ...asset, storageKey: '/certificates/../secret.pdf' }, root), null)
    assert.equal(await readCertificate({ ...asset, checksum: '0'.repeat(64) }, root), null)
    assert.equal(await readCertificate({ ...asset, mimeType: 'text/html' }, root), null)
  } finally {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}`) && basename(root).startsWith('fitness-certificate-test-'))
    await rm(root, { recursive: true, force: true })
  }
})
