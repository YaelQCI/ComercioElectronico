// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-demo-catalog-'))
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


  const { demoCatalog } = await import('../server/features/catalog/demo-catalog.js')
  for (const category of new Set(demoCatalog.map(product => product.categorySlug))) {
    const response = await fetch(`${base}/api/catalog/products?q=DEMO&categoria=${category}`)
    assert.equal(response.status, 200)
    const result = await response.json()
    const expected = demoCatalog.filter(product => product.categorySlug === category).map(product => product.slug).sort()
    assert.deepEqual(result.products.map(product => product.slug).sort(), expected)
    assert.equal(result.total, 4)
    for (const product of result.products) {
      assert.ok(product.variants[0].availableQty > 0, 'Stock de demostración inicial disponible')
      assert.equal(product.images.length >= 1, true)
      const image = await fetch(base + product.images[0].url)
      assert.equal(image.status, 200); assert.ok(image.headers.get('content-type').startsWith('image/webp'))
    }
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: base + '/catalogo?q=DEMO&categoria=proteina' })
  await until(() => evaluate(`document.querySelectorAll('[data-product-card]').length===4`)); await sleep(1000)
  await until(() => evaluate(`Array.from(document.querySelectorAll('[data-product-card] img')).filter(e=>e.getBoundingClientRect().width>0).every(e=>e.complete&&e.naturalWidth>0)`))
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  if (process.env.TEST_DEMO_SCREENSHOT) { const shot = await command('Page.captureScreenshot', { format: 'png' }); await writeFile(process.env.TEST_DEMO_SCREENSHOT, Buffer.from(shot.data, 'base64')) }
  const product = await (await fetch(base + '/api/catalog/products?q=DEMO&categoria=proteina')).json()
  await command('Page.navigate', { url: base + '/producto/' + product.products[0].id })
  await until(() => evaluate(`!!document.querySelector('#product-nutrition-heading')`)); await sleep(800)
  assert.ok(await evaluate(`document.body.textContent.includes('DATOS ILUSTRATIVOS')`))
  assert.ok(await evaluate(`document.body.textContent.includes('Proteínas')`))
  const reviewed = product.products.find(item => item.slug === 'demo-proteina-2')
  const reviews = await (await fetch(`${base}/api/reviews/products/${reviewed.id}`)).json()
  assert.equal(reviews.total, 1)
  assert.ok(reviews.reviews[0].author.includes('DEMO'))
  assert.ok(reviews.reviews[0].body.includes('DEMOSTRACIÓN'))
  await command('Page.navigate', { url: base + '/producto/' + reviewed.id })
  await until(() => evaluate(`document.querySelector('section[aria-label="Reseñas verificadas"]')?.textContent.includes('Cliente DEMO')`))
  assert.ok(await evaluate(`document.querySelector('section[aria-label="Reseñas verificadas"]').textContent.includes('RESEÑA DE DEMOSTRACIÓN')`))
  for (const theme of ['light', 'dark']) {
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`)
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  }
  console.log('Catálogo real local: 4 DEMO por categoría, stock, 28 imágenes HTTP 200, tarjetas, nutrición, reseña DEMO y ancho móvil en ambos temas correctos. Solo lecturas; sin cambios de datos.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-demo-catalog-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
