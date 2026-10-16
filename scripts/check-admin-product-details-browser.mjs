// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-admin-details-'))
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
let socket
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn) {
  for (let i = 0; i < 100; i++) { const result = await Promise.resolve().then(fn).catch(() => false); if (result) return result; await sleep(100) }
  throw Error('La comprobación del navegador excedió 10 segundos.')
}
try {
  browser.on('error', error => { console.error(error.message) })
  const port = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let sequence = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id)
      clearTimeout(timer); pending.delete(message.id)
      if (message.error) reject(Error(message.error.message)); else resolve(message.result)
    }
  }
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`Sin respuesta CDP: ${method}`)) }, 10000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text)
    return result.result.value
  }


  const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004']
  const user = { id: ids[3], role: 'ADMIN', email: 'fixture@example.invalid', displayName: 'Prueba', themePreference: 'dark' }
  const variant = { id: ids[1], sku: 'FIXTURE', flavor: 'Natural', presentationLabel: '300 g', contentAmount: '300', contentUnit: 'g', servings: '60', servingAmount: null, servingUnit: null, nutritionData: null, weightGrams: 300, lengthMm: 100, widthMm: 100, heightMm: 100, priceCents: '10000', compareAtPriceCents: null, priceVersion: 1, deactivated: false }
  let product = { id: ids[0], name: 'Producto sintético', slug: 'fixture', description: 'Prueba local', updatedAt: '2026-10-16T12:00:00.000Z', published: false, deactivated: false, categories: [], images: [], variants: [variant], recommendations: [], brandId: null, brand: null, featuredPosition: null }
  let brands = [], saved, newVariant, trace, certificate, authenticated = false
  const lot = { id: ids[2], productId: ids[0], variantId: ids[1], productName: product.name, sku: variant.sku, warehouse: 'Prueba', lotCode: 'FIXTURE', version: 1, origin: null, importedOn: null, customsEntry: null, certificateUrl: null, expiresOn: '2028-01-01', onHandQty: 10, reservedQty: 0, nonSellableQty: 0, isBlocked: false }
  const exceptions = []
  const originalMessage = socket.onmessage
  socket.onmessage = event => {
    originalMessage(event)
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    if (message.method !== 'Fetch.requestPaused') return
    const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname
    let payload = {}
    if (path === '/api/account/login') { authenticated = true; payload = { user } }
    else if (path === '/api/account/session') payload = { user: authenticated ? user : null }
    else if (path === '/api/account/profile') payload = { user, addresses: [] }
    else if (path === '/api/account/points') payload = { balanceTenths: '0', availableTenths: '0', reservedTenths: '0', movements: [], pages: 0 }
    else if (path === '/api/admin/catalog/options') payload = { brands, products: [{ id: ids[2], name: 'Recomendado sintético', published: true }], hasMore: false }
    else if (path === '/api/admin/catalog/brands') { const body = JSON.parse(request.postData); payload = { id: ids[3], ...body }; brands = [payload] }
    else if (path === '/api/admin/categories') payload = { categories: [] }
    else if (path.endsWith('/variants') && request.method === 'POST') { newVariant = JSON.parse(request.postData); product.variants.push({ ...variant, ...newVariant, id: ids[3], priceCents: newVariant.priceCents, priceVersion: 1, deactivated: false }); product.updatedAt = '2026-10-16T12:02:00.000Z'; payload = { id: ids[3] } }
    else if (path === `/api/admin/catalog/${ids[0]}` && request.method === 'PATCH') { saved = JSON.parse(request.postData); product = { ...product, ...saved, updatedAt: '2026-10-16T12:01:00.000Z', variants: saved.variants?.map(item => ({ ...variant, ...item, priceVersion: 2 })) ?? product.variants, recommendations: (saved.relatedProductIds ?? []).map(id => ({ id, kind: 'RELATED', name: 'Recomendado sintético' })) }; payload = { id: product.id } }
    else if (path === '/api/admin/catalog') payload = { products: [product], page: 1, pages: 1, total: 1 }
    else if (path === '/api/admin/inventory') payload = { lots: [lot], warehouses: [], pages: 1, total: 1, page: 1 }
    else if (path.endsWith('/traceability')) { trace = JSON.parse(request.postData); Object.assign(lot, trace, { version: 2 }); payload = { id: lot.id } }
    else if (path.endsWith('/certificate') && request.method === 'POST') { certificate = request.postData; lot.certificateUrl = `/api/catalog/lots/${lot.id}/certificate`; lot.version++; payload = { id: lot.id } }
    else if (path === '/api/admin/packages') payload = { packages: [], pages: 1, total: 0 }
    else if (request.method !== 'GET') throw Error(`Mutación inesperada: ${path}`)
    void command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') })
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Fetch.enable', { patterns: [{ urlPattern: '*/api/account/*' }, { urlPattern: '*/api/admin/*' }] })
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: base + '/cuenta' })
  await until(() => evaluate(`!!document.querySelector('#account-email')`)); await sleep(1200)
  async function fill(id, value) { await evaluate(`{ const e=document.getElementById(${JSON.stringify(id)}); if(!e) throw Error(${JSON.stringify(id)}); e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})); }`) }
  async function click(text) { await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`); await sleep(150) }
  await fill('account-email', user.email); await fill('account-password', 'SyntheticPassword123!')
  await evaluate(`document.querySelector('#account-email').closest('form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('a[href="/admin"]')`)); await sleep(300)
  await evaluate(`document.querySelector('a[href="/admin"]').click()`)
  await until(() => evaluate(`document.body.textContent.includes('Gestionar Producto sintético')`))
  await click('Gestionar Producto sintético')
  await until(() => evaluate(`!!document.querySelector('#edit-ingredients')`))
  await click('Registrar marca')
  await fill('edit-brand-name', 'Marca sintética'); await fill('edit-brand-slug', 'marca-fixture'); await fill('edit-brand-reason', 'Prueba sin persistencia')
  assert.equal(await evaluate(`document.querySelector('#edit-brand-name').closest('form').parentElement.closest('form')===null`), true)
  await evaluate(`document.querySelector('#edit-brand-name').closest('form').requestSubmit()`)
  await until(() => brands.length === 1); await until(() => evaluate(`document.querySelector('#edit-brand').value===${JSON.stringify(ids[3])}`))
  await fill('edit-ingredients', 'Ingrediente documentado\nSegunda línea'); await fill('edit-usageInstructions', 'Uso documentado'); await fill('edit-allergenInformation', 'Alérgenos documentados')
  await fill(`edit-${ids[1]}-serving-amount`, '5'); await fill(`edit-${ids[1]}-serving-unit`, 'g')
  await click('Agregar nutrimento'); await fill(`edit-${ids[1]}-nutrient-0`, 'Proteínas'); await fill(`edit-${ids[1]}-amount-0`, '2.5'); await fill(`edit-${ids[1]}-unit-0`, 'g')
  await until(() => evaluate(`document.querySelector('input[type="checkbox"]')!==null`))
  await evaluate(`document.querySelector('fieldset input[type="checkbox"]').click()`)
  await fill('edit-reason', 'Prueba de formulario')
  await evaluate(`document.querySelector('#edit-name').closest('form').requestSubmit()`)
  await until(() => saved); assert.equal(saved.brandId, ids[3]); assert.equal(saved.ingredients, 'Ingrediente documentado\nSegunda línea'); assert.equal(saved.usageInstructions, 'Uso documentado'); assert.equal(saved.allergenInformation, 'Alérgenos documentados')
  assert.equal(saved.variants[0].servingAmount, '5'); assert.deepEqual(saved.variants[0].nutritionData.rows, [{ name: 'Proteínas', amount: '2.5', unit: 'g' }]); assert.deepEqual(saved.relatedProductIds, [ids[2]])
  await until(() => evaluate(`document.querySelector('#edit-reason').value===''`))
  assert.equal(await evaluate(`document.getElementById('edit-${ids[1]}-nutrient-0').value`), 'Proteínas')
  await click('Agregar presentación'); await until(() => evaluate(`!!document.querySelector('#new-variant-sku')`))
  const fields = { sku: 'FIXTURE-500', flavor: 'Natural', presentationLabel: '500 g', contentAmount: '500', contentUnit: 'g', pricePesos: '150.00', weightGrams: '500', lengthMm: '100', widthMm: '100', heightMm: '100' }
  for (const [key, value] of Object.entries(fields)) await fill(`new-variant-${key}`, value)
  await fill('new-variant-reason', 'Prueba de presentación'); await evaluate(`document.querySelector('#new-variant-sku').closest('form').requestSubmit()`)
  await until(() => newVariant); assert.equal(newVariant.priceCents, '15000'); await until(() => evaluate(`!!document.getElementById('edit-${ids[3]}-sku')`))
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  if (process.env.TEST_ADMIN_SCREENSHOT) { await evaluate(`document.querySelector('#edit-ingredients').scrollIntoView()`); const shot = await command('Page.captureScreenshot', { format: 'png' }); await writeFile(process.env.TEST_ADMIN_SCREENSHOT, Buffer.from(shot.data, 'base64')) }
  await click('Cerrar edición'); await click('Inventario')
  await until(() => evaluate(`document.body.textContent.includes('Editar trazabilidad y certificado')`))
  await click('Editar trazabilidad y certificado')
  await fill(`trace-${ids[2]}-origin`, 'Origen documentado'); await fill(`trace-${ids[2]}-imported`, '2026-10-01'); await fill(`trace-${ids[2]}-customs`, 'Aduana documentada'); await fill(`trace-reason-${ids[2]}`, 'Prueba de trazabilidad')
  await click('Guardar trazabilidad'); await until(() => trace); assert.equal(trace.expectedVersion, 1); assert.equal(trace.importedOn, '2026-10-01')
  await until(() => evaluate(`document.body.textContent.includes('Origen documentado')`)); await click('Editar trazabilidad y certificado')
  await fill(`trace-reason-${ids[2]}`, 'Prueba de PDF')
  await evaluate(`{const e=document.getElementById('certificate-${ids[2]}'),dt=new DataTransfer();dt.items.add(new File(['%PDF-1.4\\nFixture\\n%%EOF'], 'fixture.pdf',{type:'application/pdf'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));}`)
  await click('Guardar trazabilidad'); await until(() => certificate); assert.ok(certificate.includes('fixture.pdf')); assert.ok(certificate.includes('application/pdf'))
  await until(() => evaluate(`document.body.textContent.includes('Ver PDF (nueva pestaña)')`))
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  assert.deepEqual(exceptions, [])
  console.log('Panel administrativo: marca, textos, nutrientes, recomendaciones, presentación, trazabilidad, PDF y ancho móvil correctos. Todas las escrituras y la sesión fueron simuladas; sin cambios comerciales reales.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-admin-details-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
