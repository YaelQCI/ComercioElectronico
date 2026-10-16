// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-loading-'))
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

  let delay = 1800, failNext = false, intercepted = 0
  const originalMessage = socket.onmessage
  socket.onmessage = event => {
    originalMessage(event)
    const message = JSON.parse(event.data)
    if (message.method !== 'Fetch.requestPaused') return
    intercepted++
    const {requestId} = message.params
    const failing = failNext
    void (async () => {
      await sleep(delay)
      if (failing) await command('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({statusCode:503,statusMessage:'Synthetic failure'})).toString('base64')})
      else await command('Fetch.continueRequest',{requestId})
    })()
  }
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Page.navigate',{url:base+'/cuenta'})
  await until(() => evaluate(`!!document.querySelector('a[href="/catalogo"]')`))
  await sleep(1200)
  await command('Fetch.enable',{patterns:[{urlPattern:'*/api/catalog/products*'}]})
  await evaluate(`document.querySelector('a[href="/catalogo"]').click()`)
  await until(() => evaluate('!!document.querySelector("[data-page-loading]")'))
  assert.equal(await evaluate('document.querySelector("#contenido").getAttribute("aria-busy")'),'true')
  assert.equal(await evaluate('document.querySelector("#contenido > div[inert]") !== null'),true)
  if (process.env.TEST_LOADING_SCREENSHOT) {
    const shot=await command('Page.captureScreenshot',{format:'png'})
    await writeFile(process.env.TEST_LOADING_SCREENSHOT,Buffer.from(shot.data,'base64'))
  }
  await until(() => evaluate('location.pathname==="/catalogo" && !document.querySelector("[data-page-loading]")'))
  assert.ok(intercepted>0)
  assert.equal(await evaluate('document.querySelector("#contenido").getAttribute("aria-busy")'),'false')
  await evaluate('(()=>{const input=document.querySelector("#header-search");input.value="protein";input.dispatchEvent(new Event("input",{bubbles:true}));input.closest("form").requestSubmit()})()')
  await until(() => evaluate('!!document.querySelector("[data-loading-skeleton]")'))
  await until(() => evaluate('!document.querySelector("[data-loading-skeleton]")'))
  failNext=true
  await evaluate('(()=>{const input=document.querySelector("#header-search");input.value="synthetic-failure";input.dispatchEvent(new Event("input",{bubbles:true}));input.closest("form").requestSubmit()})()')
  await until(() => evaluate('!!document.querySelector("[data-loading-skeleton]")'))
  await until(() => evaluate('!document.querySelector("[data-loading-skeleton]") && !document.querySelector("[data-page-loading]")'))
  assert.ok(await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Reintentar"))'))
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true)
  console.log('Carga: navegación lenta, skeletons, contenido anterior inerte, fin de carga, búsquedas, recuperación de errores y ancho móvil correctos. Solo lecturas y errores simulados.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-loading-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
