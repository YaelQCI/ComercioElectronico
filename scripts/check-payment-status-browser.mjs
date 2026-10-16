// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-payment-status-'))
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

  const orderId = '00000000-0000-4000-8000-000000000001'
  let mode = 'pending', reads = 0, active = 0, maxActive = 0, delayNext = 0, failNext = false
  const originalMessage = socket.onmessage
  socket.onmessage = event => {
    originalMessage(event)
    const message = JSON.parse(event.data)
    if (message.method !== 'Fetch.requestPaused') return
    if (message.params.request.method !== 'POST') throw Error('Método inesperado')
    reads++; active++; maxActive = Math.max(maxActive, active)
    const current = mode, delay = delayNext, failing = failNext
    delayNext = 0; failNext = false
    void (async () => {
      if (delay) await sleep(delay)
      const payload = failing ? { statusCode: 503, statusMessage: 'No pudimos consultar el pedido sintético.' } : {
        orderId, number: 'TFS-PEDIDO-SINTETICO-00000000-0000-4000-8000-000000000001',
        status: current === 'pending' ? 'PENDING_PAYMENT' : 'CONFIRMED',
        moneyStatus: current === 'pending' ? 'PENDING' : current === 'refund' ? 'REFUNDED' : 'PAID',
        totalMoneyCents: '95372', currency: 'MXN', expiresAt: '2030-01-01T12:00:00Z', needsReview: false,
      }
      active--
      await command('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: failing ? 503 : 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') })
    })()
  }
  await command('Fetch.enable', { patterns: [{ urlPattern: base + '/api/payments/status' }] })
  await command('Page.enable')
  await command('Emulation.setTimezoneOverride', { timezoneId: 'America/Mexico_City' })
  await command('Page.navigate', { url: `${base}/pago?pedido=${orderId}` })
  await until(() => evaluate(`document.body.textContent.includes('Tu pago está pendiente') && !!document.querySelector('[data-toast-region]')`))
  assert.equal(await evaluate(`document.querySelector('.payment-success')===null`), true)
  await evaluate(`window.paymentPageMarker='sin-recarga';window.testVisibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.testVisibility})`)
  await sleep(550)
  const initial = reads
  mode = 'paid'
  await evaluate(`testVisibility='hidden';document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))`)
  await sleep(100)
  assert.equal(reads, initial)
  await evaluate(`testVisibility='visible';document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))`)
  await until(() => evaluate(`document.body.textContent.includes('¡Gracias por tu compra!')`))
  assert.equal(reads, initial + 1)
  assert.equal(await evaluate('window.paymentPageMarker'), 'sin-recarga')
  assert.equal(await evaluate(`document.body.textContent.includes('Pago validado')`), true)
  assert.equal(await evaluate(`document.body.textContent.includes('MXN MXN')`), false)
  assert.equal(await evaluate(`document.body.textContent.includes('Plazo de este intento')`), false)
  assert.match(await evaluate(`getComputedStyle(document.querySelector('.payment-check')).animationName`), /^payment-draw/)
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.payment-check')).animationName`), 'none')
  if (process.env.TEST_SCREENSHOT_PATH) {
    await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false })
    await evaluate(`document.documentElement.dataset.theme='dark'`)
    const shot = await command('Page.captureScreenshot', { format: 'png' })
    await (await import('node:fs/promises')).writeFile(process.env.TEST_SCREENSHOT_PATH, Buffer.from(shot.data, 'base64'))
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: true })
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true)
  await evaluate(`document.documentElement.dataset.theme='light'`)
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true)
  if (process.env.TEST_MOBILE_SCREENSHOT_PATH) {
    const shot = await command('Page.captureScreenshot', { format: 'png' })
    await (await import('node:fs/promises')).writeFile(process.env.TEST_MOBILE_SCREENSHOT_PATH, Buffer.from(shot.data, 'base64'))
  }
  await sleep(550)
  failNext = true
  await evaluate(`document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Actualizar estado')b.click()})`)
  await until(() => evaluate(`document.body.textContent.includes('Mostramos el último estado consultado.')`))
  assert.equal(await evaluate(`document.body.textContent.includes('¡Gracias por tu compra!')`), true)
  await sleep(550)
  const beforeConcurrent = reads
  mode = 'refund'; delayNext = 900
  await evaluate(`document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Actualizar estado')b.click()})`)
  await until(() => reads > beforeConcurrent)
  await sleep(550)
  mode = 'paid'
  await evaluate(`window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))`)
  await until(async () => reads >= beforeConcurrent + 2 && await evaluate(`document.body.textContent.includes('¡Gracias por tu compra!') && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Actualizar estado'&&!b.disabled)`))
  assert.equal(maxActive, 1)
  await evaluate(`document.querySelector('a[href="/catalogo"]').click()`)
  await until(() => evaluate(`location.pathname==='/catalogo'`))
  const afterUnmount = reads
  await sleep(550)
  await evaluate(`window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))`)
  await sleep(100)
  assert.equal(reads, afterUnmount)
  console.log('Estado de pago: pendiente sin celebración, éxito validado, animación/movimiento reducido, regreso a pestaña sin recarga, eventos deduplicados, errores con último estado, consultas sin solapar y limpieza al salir correctos. APIs simuladas, sin cobros.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-payment-status-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
