// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-checkout-'))
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

  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.invalid', role: 'CUSTOMER', displayName: 'Fixture', themePreference: 'system' }
  const address = { id: '00000000-0000-4000-8000-000000000002', label: 'Prueba aislada', recipientName: 'Destinatario sintético', phone: '5555555555', countryCode: 'MX', postalCode: '01000', state: 'CX', city: 'Ciudad sintética', district: 'Colonia sintética', street: 'Calle sintética', exteriorNumber: '1', interiorNumber: '', isDefault: true }
  const cart = { version: 1, pieces: 1, products: 1, saved: [], coupon: null, totals: { goodsMoneyCents: '10000', goodsAfterCouponCents: '10000', goodsBeforeCouponCents: '10000', couponDiscountCents: '0' }, lines: [{ id: '00000000-0000-4000-8000-000000000003', variantId: '00000000-0000-4000-8000-000000000004', productId: '00000000-0000-4000-8000-000000000005', name: 'Producto sintético', presentation: 'Presentación sintética', sku: 'FIXTURE', quantity: 1, unitPriceCents: '10000', valid: true, stockSufficient: true, availableQty: 2, maxQuantity: 2 }] }
  let quote = null, prepareCount = 0, selectionCount = 0, quotedDestination, preparedBody
  const previousOnMessage = socket.onmessage
  socket.onmessage = event => {
    previousOnMessage(event)
    const message = JSON.parse(event.data)
    if (message.method !== 'Fetch.requestPaused') return
    const request = message.params.request, path = new URL(request.url).pathname
    let response
    if (path === '/api/cart') response = cart
    else if (path === '/api/account/session') response = { user, accessExpiresAt: new Date(Date.now() + 600000).toISOString(), refreshAvailable: false }
    else if (path === '/api/account/profile') response = { addresses: [address] }
    else if (path === '/api/shipping/selected' && request.method === 'GET') response = { selected: quote }
    else if (path === '/api/shipping/quotes') {
      quotedDestination = JSON.parse(request.postData).destination
      response = { cartVersion: 1, quotes: [{ id: '00000000-0000-4000-8000-000000000006', carrierCode: 'fixture', serviceName: 'Envío sintético', chargedAmountCents: '5000', quotedAmountCents: '5000', eligible: false }] }
    } else if (path === '/api/shipping/selected') {
      selectionCount++
      quote = { id: '00000000-0000-4000-8000-000000000006', cartVersion: 1, carrierCode: 'fixture', serviceName: 'Envío sintético', chargedAmountCents: '5000', quotedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + (selectionCount === 1 ? 1200 : 600000)).toISOString(), destination: JSON.parse(request.postData).destination }
      response = { selected: quote }
    } else if (path === '/api/checkout/prepare') {
      prepareCount++; preparedBody = JSON.parse(request.postData)
      response = { orderId: '00000000-0000-4000-8000-000000000007', number: 'PEDIDO-SINTETICO', totalMoneyCents: '15000', currency: 'MXN', paymentEnabled: false }
    } else throw Error(`Solicitud inesperada: ${path}`)
    void command('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(response)).toString('base64') })
  }
  await command('Fetch.enable', { patterns: ['/api/cart', '/api/account/session', '/api/account/profile', '/api/shipping/*', '/api/checkout/prepare'].map(path => ({ urlPattern: base + path + '*' })) })
  await command('Page.enable')
  await command('Page.navigate', { url: base + '/catalogo?q=prueba-sintetica' })
  await until(() => evaluate(`document.querySelector('[data-toast-region]') && document.querySelector('a[href="/carrito"]')`))
  await until(() => evaluate(`document.body.textContent.includes('1')`))
  await evaluate(`document.querySelector('a[href="/carrito"]').click()`)
  await until(() => evaluate(`location.pathname==='/carrito' && document.body.textContent.includes('Producto sintético')`))
  assert.equal(await evaluate(`document.querySelector('#shipping-name')===null`), true)
  await evaluate(`[...document.querySelectorAll('a')].find(el=>el.textContent.trim()==='Continuar con la compra').click()`)
  await until(() => evaluate(`location.pathname==='/checkout' && !!document.querySelector('#shipping-name')`))
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`)
  const continueDisabled = () => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Continuar a confirmar pedido').disabled`)
  assert.equal(await evaluate(`document.querySelector('[aria-current="step"]').textContent.includes('Cotizar envío')`), true)
  await until(() => evaluate(`document.querySelector('#shipping-name').value==='Destinatario sintético'`))
  assert.equal(await evaluate(`document.querySelector('#checkout-district').value`), address.district)
  assert.equal(await evaluate(`document.querySelector('#checkout-exteriorNumber').value`), address.exteriorNumber)
  assert.equal(await continueDisabled(), true)
  await click('Continuar a confirmar pedido')
  assert.equal(await evaluate(`document.querySelector('[aria-current="step"]').textContent.includes('Cotizar envío')`), true)
  await click('Cotizar servicios')
  await until(() => evaluate(`document.body.textContent.includes('Aceptar esta tarifa')`))
  assert.equal(await continueDisabled(), true)
  await click('Continuar a confirmar pedido')
  assert.equal(await evaluate(`document.querySelector('[aria-current="step"]').textContent.includes('Cotizar envío')`), true)
  await click('Aceptar esta tarifa')
  await until(() => evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Servicio seleccionado' && !b.disabled)`))
  await until(async () => !(await continueDisabled()))
  await until(continueDisabled)
  assert.equal(await continueDisabled(), true)
  await click('Cotizar servicios')
  await until(() => evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Aceptar esta tarifa')`))
  await click('Aceptar esta tarifa')
  await until(async () => !(await continueDisabled()))
  await click('Continuar a confirmar pedido')
  await until(() => evaluate(`document.querySelector('[aria-current="step"]').textContent.includes('Confirmar pedido')`))
  assert.equal(prepareCount, 0)
  await click('Editar datos')
  assert.equal(await evaluate(`document.querySelector('#shipping-name').value`), address.recipientName)
  await evaluate(`const input=document.querySelector('#shipping-name');input.value='Destinatario actualizado';input.dispatchEvent(new Event('input',{bubbles:true}))`)
  await until(continueDisabled)
  await click('Continuar a confirmar pedido')
  assert.equal(await evaluate(`document.querySelector('[aria-current="step"]').textContent.includes('Cotizar envío')`), true)
  await click('Cotizar servicios')
  await until(() => evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Aceptar esta tarifa')`))
  await click('Aceptar esta tarifa')
  await until(() => evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Servicio seleccionado' && !b.disabled)`))
  await click('Continuar a confirmar pedido')
  await evaluate(`document.querySelector('input[type="checkbox"]').click()`)
  await click('Confirmar pedido y continuar al pago')
  await until(() => evaluate(`document.querySelector('[aria-current="step"]').textContent.includes('Pago')`))
  assert.equal(prepareCount, 1)
  assert.equal(preparedBody.address.street, quotedDestination.street)
  assert.equal(preparedBody.address.district, address.district)
  assert.equal(preparedBody.expectedTotalCents, '15000')
  assert.equal(await evaluate(`document.body.textContent.includes('PEDIDO-SINTETICO')`), true)
  console.log('Compra en navegador: carrito sin cotizador, envío primero, dirección guardada, selección obligatoria, confirmación, vuelta y pago correctos. APIs simuladas; sin cotizaciones externas ni escrituras de negocio.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-checkout-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
