// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-theme-'))
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
let socket
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn) {
  for (let i = 0; i < 100; i++) { const result = await fn().catch(() => false); if (result) return result; await sleep(100) }
  throw Error('La comprobación del navegador excedió 10 segundos.')
}
try {
  browser.on('error', error => { console.error(error.message) })
  const port = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let sequence = 0
  let loadEvents = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.loadEventFired') loadEvents++
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
  async function loaded() { await until(() => evaluate(`!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Usar tema'))`)) }
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`)
  await command('Page.enable')
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  let previousLoad = loadEvents
  await command('Page.navigate', { url: `${base}/sistema-visual` })
  await until(async () => loadEvents > previousLoad); await loaded()
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark')
  await click('Usar tema claro')
  await until(() => evaluate(`document.documentElement.dataset.theme === 'light'`))
  assert.equal(await evaluate(`localStorage.getItem('fitness_theme')`), 'light')
  previousLoad = loadEvents
  await command('Page.reload')
  await until(async () => loadEvents > previousLoad); await loaded()
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light')
  // Navegación Nuxt desde la muestra hasta inicio preserva preferencia.
  await evaluate(`document.querySelector('a[href="/"]').click()`)
  await until(() => evaluate(`location.pathname === '/'`)); await loaded()
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light')
  await click('Usar tema del sistema')
  await until(() => evaluate(`document.documentElement.dataset.theme === 'dark'`))
  assert.equal(await evaluate(`localStorage.getItem('fitness_theme')`), null)
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
  await until(() => evaluate(`document.documentElement.dataset.theme === 'light'`))
  // Comprobar controles en móvil; el selector no desborda la página.
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await click('Usar tema oscuro')
  await until(() => evaluate(`document.documentElement.dataset.theme === 'dark'`))
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true)
  if (process.env.TEST_SCREENSHOT_PATH) {
    const shot = await command('Page.captureScreenshot', { format: 'png' })
    await writeFile(process.env.TEST_SCREENSHOT_PATH, Buffer.from(shot.data, 'base64'))
  }
  console.log('Navegador: sistema, selección, recarga, navegación Nuxt, vuelta al sistema y móvil correctos.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-theme-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
