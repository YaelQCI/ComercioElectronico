// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-product-layout-'))
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

  const live = await (await fetch(base + '/api/catalog/products')).json()
  if (!live.products?.[0]) throw Error('Se requiere un producto publicado para la referencia visual.')
  const seed = live.products[0]
  const product = (await (await fetch(`${base}/api/catalog/products/${seed.id}`)).json()).product
  const baseVariant = product.variants[0]
  const id = index => index === 1 ? baseVariant.id : `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  product.description = 'Descripción sintética para comprobar la presentación de los detalles del producto.'
  product.ingredients = 'Ingredientes documentados de prueba.'
  product.usageInstructions = 'Modo de uso documentado de prueba.'
  product.variants = [
    { ...baseVariant, id: id(1), presentationLabel: '300 g', flavor: 'Chocolate', priceCents: '74900', servings: '60', availableQty: 10 },
    { ...baseVariant, id: id(2), presentationLabel: '500 g', flavor: 'Chocolate', priceCents: '114900', servings: '100', availableQty: 2 },
    { ...baseVariant, id: id(3), presentationLabel: '1 kg', flavor: 'Chocolate', priceCents: '199900', servings: '200', availableQty: 0, lots: [] },
    { ...baseVariant, id: id(4), presentationLabel: '300 g', flavor: 'Vainilla', priceCents: '89900', servings: '60', availableQty: 4 },
  ].map((variant, index) => ({ ...variant, sku: `FIXTURE-${index + 1}`, compareAtPriceCents: null, nutritionData: { rows: [{ name: 'Nutrimento de prueba', amount: String(index + 1), unit: 'g' }] }, lots: index === 2 ? [] : [{ id: id(20 + index), lotCode: `LOTE-${index + 1}`, expiresOn: '2027-09-30', importedOn: '2026-10-01', origin: 'Origen de prueba', customsEntry: 'Registro de prueba', certificateUrl: '/certificado-de-prueba.pdf' }] }))
  const front = product.images.find(image => image.kind === 'FRONT')
  const back = product.images.find(image => image.kind === 'NUTRITION') ?? front
  if (!front) throw Error('Se requiere una imagen frontal de referencia.')
  product.images = Array.from({ length: 5 }, (_, index) => ({ ...front, id: id(40 + index), variantId: null, kind: index === 0 ? 'FRONT' : index === 1 ? 'NUTRITION' : 'GALLERY', url: index % 2 ? back.url : front.url, alt: `Imagen de prueba ${index + 1}` }))
  product.images.push({ ...back, id: id(50), variantId: id(2), kind: 'FRONT', alt: 'Frente de 500 g' })
  const recommendations = Array.from({ length: 4 }, (_, index) => ({ ...structuredClone(seed), id: id(70 + index), name: `Relacionado de prueba ${index + 1}` }))
  const reviews = { total: 3, average: 4, distribution: { 5: 1, 4: 1, 3: 1, 2: 0, 1: 0 }, pages: 1, reviews: [5, 4, 3].map((rating, index) => ({ id: id(90 + index), author: `Comprador de prueba ${index + 1}`, rating, title: '', body: 'Opinión sintética para verificar la distribución visual.', createdAt: '2026-10-16T00:00:00.000Z' })) }
  const additions = [], exceptions = []
  const originalMessage = socket.onmessage
  socket.onmessage = event => {
    originalMessage(event)
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
    if (message.method !== 'Fetch.requestPaused') return
    const { requestId, request } = message.params
    const path = new URL(request.url).pathname
    let payload
    if (path === '/api/cart/items' && request.method === 'POST') { additions.push(JSON.parse(request.postData)); payload = { pieces: additions.at(-1).quantity, products: 1, version: additions.length, lines: [], saved: [], totals: { goodsMoneyCents: '0' } } }
    else if (path.startsWith('/api/reviews/')) payload = reviews
    else if (path === '/api/catalog/recommendations') payload = { products: recommendations }
    else payload = { product }
    void command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') })
  }
  const variantReady = variantId => until(() => evaluate(`new URLSearchParams(location.search).get('variante')===${JSON.stringify(variantId)} && document.querySelector('fieldset[aria-label="Presentación del producto"] button[aria-pressed="true"]').textContent.includes(${JSON.stringify(product.variants.find(v => v.id === variantId)?.presentationLabel ?? '')})`))
  const setQuantity = value => evaluate(`(()=>{const field=document.querySelector('#product-quantity');field.value=${JSON.stringify(value)};field.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await command('Page.enable'); await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1912, height: 1080, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: base + '/catalogo' })
  await until(() => evaluate(`!!document.querySelector('a[href^="/producto/"]')`)); await sleep(1200)
  await command('Fetch.enable', { patterns: [{ urlPattern: '*/api/catalog/products/*' }, { urlPattern: '*/api/catalog/recommendations*' }, { urlPattern: '*/api/reviews/products/*' }, { urlPattern: '*/api/cart/items' }] })
  await evaluate(`document.querySelector('a[href^="/producto/"]').click()`)
  await until(() => evaluate(`!!document.querySelector('[aria-label="Acciones de compra"]') && !document.querySelector('[data-page-loading]')`))
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Seleccionar imagen"] button').length`), 5)
  assert.ok(await evaluate(`document.querySelector('[aria-label="Seleccionar imagen"]').getBoundingClientRect().top >= document.querySelector('figure').getBoundingClientRect().bottom`))
  await evaluate(`document.querySelector('button[aria-label="Imagen siguiente"]').click()`)
  await until(() => evaluate(`document.querySelector('figure img')?.alt==='Imagen de prueba 2'`))
  await evaluate(`document.querySelector('button[aria-label="Imagen anterior"]').click()`)
  await until(() => evaluate(`document.querySelector('figure img')?.alt==='Imagen de prueba 1'`))
  await evaluate(`document.querySelectorAll('fieldset[aria-label="Presentación del producto"] button')[1].click()`)
  await variantReady(id(2))
  assert.ok((await evaluate(`document.querySelector('[data-product-price]').textContent`)).includes('1,149.00'))
  assert.ok((await evaluate(`document.querySelector('section[aria-labelledby="lot-heading"]').textContent`)).includes('FIXTURE-2'))
  assert.ok((await evaluate(`document.querySelector('section[aria-labelledby="product-nutrition-heading"]').textContent`)).includes('2 g'))
  await until(() => evaluate(`document.querySelector('figure img')?.alt==='Frente de 500 g'`))
  assert.equal(await evaluate(`document.querySelector('#product-quantity').value`), '1')
  await evaluate(`document.querySelector('button[aria-label="Aumentar cantidad"]').click()`)
  assert.equal(await evaluate(`document.querySelector('#product-quantity').value`), '2')
  assert.ok(await evaluate(`document.querySelector('button[aria-label="Aumentar cantidad"]').disabled`))
  await setQuantity('3')
  assert.ok(await evaluate(`document.querySelector('[aria-label="Acciones de compra"] button').disabled`))
  await setQuantity('2')
  await evaluate(`document.querySelector('[aria-label="Acciones de compra"] button').click()`)
  await until(() => additions.length === 1)
  assert.equal(additions[0].variantId, id(2)); assert.equal(additions[0].quantity, 2)
  assert.ok((await evaluate('location.pathname')).startsWith('/producto/'))
  await evaluate(`document.querySelectorAll('fieldset[aria-label="Presentación del producto"] button')[2].click()`)
  await variantReady(id(3))
  assert.ok(await evaluate(`document.querySelector('[aria-label="Acciones de compra"] button').disabled`))
  await evaluate(`document.querySelector('#flavor').value='Vainilla';document.querySelector('#flavor').dispatchEvent(new Event('change',{bubbles:true}))`)
  await variantReady(id(4))
  assert.ok((await evaluate(`document.querySelector('[data-product-price]').textContent`)).includes('899.00'))
  await evaluate(`document.querySelector('#flavor').value='Chocolate';document.querySelector('#flavor').dispatchEvent(new Event('change',{bubbles:true}))`)
  await variantReady(id(1))
  await until(() => evaluate(`document.querySelectorAll('[data-product-card]').length===4`))
  assert.ok(!await evaluate(`!!document.querySelector('input[autocomplete="postal-code"]')`))
  assert.ok(await evaluate(`document.querySelector('#product-information-heading').nextElementSibling.querySelector('details').open`))
  assert.ok(await evaluate(`!!document.querySelector('section[aria-labelledby="portion-comparison-heading"] .bg-accent-soft')`))
  await evaluate(`document.querySelectorAll('[data-toast-region] button').forEach(button=>button.click())`)
  for (const theme of ['light', 'dark']) {
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.scrollTo(0,0)`); await sleep(250)
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true)
    if (process.env.TEST_PRODUCT_SCREENSHOT_DIRECTORY) {
      const metrics = await command('Page.getLayoutMetrics')
      const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1912, height: Math.ceil(metrics.cssContentSize.height), scale: 1 } })
      await writeFile(join(process.env.TEST_PRODUCT_SCREENSHOT_DIRECTORY, `fitness-product-${theme}.png`), Buffer.from(shot.data, 'base64'))
    }
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true }); await sleep(250)
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true)
  if (process.env.TEST_PRODUCT_SCREENSHOT_DIRECTORY) { const shot = await command('Page.captureScreenshot', { format: 'png' }); await writeFile(join(process.env.TEST_PRODUCT_SCREENSHOT_DIRECTORY, 'fitness-product-mobile.png'), Buffer.from(shot.data, 'base64')) }
  await command('Emulation.setDeviceMetricsOverride', { width: 1912, height: 1080, deviceScaleFactor: 1, mobile: false })
  await evaluate(`document.querySelectorAll('[aria-label="Acciones de compra"] button')[1].click()`)
  await until(() => additions.length === 2)
  await until(() => evaluate('location.pathname==="/carrito"'))
  assert.deepEqual(exceptions, [])
  console.log('Producto: galería, presentaciones, sabor, precios, porciones, trazabilidad, cantidades máximas, agotados, agregado, compra inmediata, tablas, temas y móvil correctos. APIs de producto y carrito simuladas; sin compras reales.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-product-layout-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
