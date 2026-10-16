// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-register-admin-'))
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



  const user = { id: '10000000-0000-4000-8000-000000000001', role: 'ADMIN', email: 'fixture@example.invalid', displayName: 'Fixture' }
  let authenticated = false, rejectRegistration = true, registration, userReads = 0
  const exceptions = []
  const original = socket.onmessage
  socket.onmessage = event => {
    original(event)
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    if (message.method !== 'Fetch.requestPaused') return
    const { requestId, request } = message.params, path = new URL(request.url).pathname
    let payload = {}, responseCode = 200
    if (path === '/api/account/login') { authenticated = true; payload = { user } }
    else if (path === '/api/account/session') payload = { user: authenticated ? user : null }
    else if (path === '/api/account/profile') payload = { user, addresses: [] }
    else if (path === '/api/account/points') payload = { balanceTenths: '0', availableTenths: '0', reservedTenths: '0', movements: [], pages: 0 }
    else if (path === '/api/admin/users' && request.method === 'POST') {
      registration = JSON.parse(request.postData)
      if (rejectRegistration) { responseCode = 409; payload = { statusMessage: 'Ya existe una cuenta con ese correo.' } }
      else payload = { user: { id: 'fixture-new', email: registration.email, displayName: registration.displayName, role: 'ADMIN' } }
    } else if (path === '/api/admin/users') { userReads++; payload = { users: [user] } }
    else if (path === '/api/admin/catalog') payload = { products: [], total: 0, pages: 0, page: 1 }
    else if (path === '/api/admin/categories') payload = { categories: [] }
    else if (path === '/api/admin/catalog/options') payload = { brands: [], products: [], hasMore: false }
    void command('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{name:'Content-Type',value:'application/json'}], body:Buffer.from(JSON.stringify(payload)).toString('base64') })
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Fetch.enable', {patterns:[{urlPattern:'*/api/account/*'},{urlPattern:'*/api/admin/*'}]})
  await command('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false})
  await command('Page.navigate', {url:base+'/cuenta'})
  await until(() => evaluate("!!document.querySelector('#account-email')")); await sleep(1000)
  async function fill(id, value) { await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));})()') }
  async function click(text) { await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==='+JSON.stringify(text)+').click()'); await sleep(150) }
  await fill('account-email', user.email); await fill('account-password','SyntheticPassword123!')
  await evaluate('document.querySelector("#account-email").closest("form").requestSubmit()')
  await until(() => evaluate(`!!document.querySelector('a[href="/admin"]')`))
  await evaluate(`document.querySelector('a[href="/admin"]').click()`)
  await until(() => evaluate('document.body.textContent.includes("Registrar administrador")'))
  await click('Usuarios'); await until(() => userReads > 0)
  await click('Registrar administrador')
  await until(() => evaluate('!!document.querySelector("dialog[open] #admin-name")'))
  await fill('admin-name','Fixture nueva'); await fill('admin-email','nueva@example.invalid')
  await fill('admin-password','SyntheticPassword123!'); await fill('admin-password-confirmation','SyntheticPassword123!'); await fill('admin-registration-reason','Prueba simulada')
  await click('Crear administrador')
  await until(() => evaluate('!!document.querySelector("dialog[open] [role=alert]")'))
  assert.equal(await evaluate('document.querySelector("#admin-name").value'), 'Fixture nueva')
  rejectRegistration = false
  const readsBefore = userReads
  await click('Crear administrador')
  await until(() => userReads > readsBefore)
  await until(() => evaluate('!document.querySelector("dialog[open]")'))
  assert.equal(registration.reason, 'Prueba simulada')
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
  await click('Registrar administrador')
  await until(() => evaluate('!!document.querySelector("#admin-name")'))
  assert.equal(await evaluate('document.querySelector("#admin-password").value'), '')
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
  await evaluate('document.querySelector("dialog[open]").dispatchEvent(new Event("cancel",{cancelable:true}))')
  await until(() => evaluate('!document.querySelector("dialog[open]")'))
  assert.deepEqual(exceptions, [])
  console.log('Modal de administrador: abrir, completar, error, reintento, actualizaci?n de usuarios, limpieza de contrase?a, cierre y ancho m?vil correctos. Sesi?n y escrituras simuladas.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-register-admin-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
