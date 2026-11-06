// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-form-errors-'))
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
  const warehouse = { id: '40000000-0000-4000-8000-000000000001', name: 'Almacén sintético', configurationVersion: 1, timezone: 'America/Mexico_City' }
  const lot = { id: '50000000-0000-4000-8000-000000000001', sku: 'SKU-SINTETICO', productName: 'Producto sintético', productId: '60000000-0000-4000-8000-000000000001', warehouse: warehouse.name, lotCode: 'LOTE-SINTETICO', version: 1, onHandQty: 10, reservedQty: 4, nonSellableQty: 0, isBlocked: false }
  let adjustmentWrites = 0
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
    else if (path === '/api/admin/packages') payload = { packages: [], total: 0, page: 1, totalPages: 1 }
    else if (path === '/api/admin/inventory' && request.method === 'POST') {
      adjustmentWrites++
      if (adjustmentWrites === 1) { lot.reservedQty = 9; responseCode = 409; payload = { statusMessage: 'Solo puedes retirar 1 pieza de este lote: hay 10 en existencias y 9 reservadas.' } }
      else { const body = JSON.parse(request.postData); assert.equal(body.delta, -1); lot.onHandQty += body.delta; payload = {} }
    }
    else if (path === '/api/admin/inventory') payload = { lots: [{ ...lot }], warehouses: [warehouse], total: 1, page: 1, pages: 1 }
    void command('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{name:'Content-Type',value:'application/json'}], body:Buffer.from(JSON.stringify(payload)).toString('base64') })
  }
  await command('Page.enable'); await command('Runtime.enable')
  await command('Fetch.enable', {patterns:[{urlPattern:'*/api/account/*'},{urlPattern:'*/api/admin/*'}]})
  await command('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false})
  await command('Page.navigate', {url:base+'/cuenta'})
  await until(() => evaluate("!!document.querySelector('#account-email')")); await sleep(1000)
  async function fill(id, value) { await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));})()') }
  async function click(text) { await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==='+JSON.stringify(text)+').click()'); await sleep(150) }

  await click('Crear cuenta')
  await evaluate('document.querySelector("#account-email").closest("form").requestSubmit()')
  await until(()=>evaluate('!!document.querySelector("form [role=alert] ul")'))
  assert.match(await evaluate('document.querySelector("#account-email").closest("form").textContent'), /Nombre: completa este campo/)
  assert.equal(await evaluate('document.activeElement.id'),'account-name')
  await fill('account-name','   '); await fill('account-email','sin-arroba'); await fill('account-password','corta');await fill('account-password-confirmation','corta')
  await evaluate('document.querySelector("#account-email").closest("form").requestSubmit()');await sleep(150)
  let text=await evaluate('document.querySelector("#account-email").closest("form").textContent')
  assert.match(text,/correo válido|formato válido/);assert.match(text,/al menos 12 caracteres/);assert.match(text,/Nombre: no uses solo espacios/)
  for (const invalidEmail of ['usuario@dominio', 'a..b@dominio.com', 'a@dominio..com']) {
    await fill('account-email', invalidEmail)
    await evaluate('document.querySelector("#account-email").closest("form").requestSubmit()')
    await sleep(100)
    assert.match(await evaluate('document.querySelector("#account-email").closest("form").textContent'), /formato válido/)
  }
  await fill('account-password','á'.repeat(129));await fill('account-password-confirmation','á'.repeat(129))
  await evaluate('document.querySelector("button[aria-controls=account-password]").click()')
  await evaluate('document.querySelector("#account-email").closest("form").requestSubmit()');await sleep(150)
  assert.match(await evaluate('document.querySelector("#account-email").closest("form").textContent'),/256 bytes/)
  await fill('account-name','Cuenta sintética');await fill('account-email',user.email);await fill('account-password','SyntheticPassword123!');await fill('account-password-confirmation','SyntheticPassword123!')
  await until(()=>evaluate('!document.querySelector("#account-email").closest("form").querySelector("[role=alert] ul")'))
  assert.equal(await evaluate('document.querySelector("#account-email").getAttribute("aria-invalid")'),null)
  await click('Iniciar sesión')
  await evaluate('document.querySelector("#account-email").closest("form").requestSubmit()')
  await until(()=>evaluate('!!document.querySelector("#profile-name")'))
  await click('Agregar dirección')
  await until(()=>evaluate('!!document.querySelector("dialog[open] #address-recipientName")'))
  await fill('address-phone', '+52 (444) 123-4567')
  assert.equal(await evaluate(`(() => { const control = document.querySelector('#address-phone'); const data = new DataTransfer(); data.setData('text/plain', 'abc123'); return control.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); })()`), false)
  assert.equal(await evaluate('document.querySelector("#address-phone").value'), '+52 (444) 123-4567')
  await fill('address-phone', '')
  await fill('address-postalCode', '01000')
  assert.equal(await evaluate(`(() => { const control = document.querySelector('#address-postalCode'); const data = new DataTransfer(); data.setData('text/plain', '12abc'); return control.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); })()`), false)
  assert.equal(await evaluate('document.querySelector("#address-postalCode").value'), '01000')
  assert.equal(await evaluate(`document.querySelector('#address-postalCode').dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'e', bubbles: true, cancelable: true }))`), false)
  await fill('address-postalCode', '')
  await evaluate('document.querySelector("#address-recipientName").closest("form").requestSubmit()');await sleep(150)
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'),/Código postal: completa/)
  await fill('address-postalCode','123')
  await evaluate('document.querySelector("#address-recipientName").closest("form").requestSubmit()');await sleep(150)
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'),/exactamente cinco dígitos/)
  assert.equal(await evaluate('document.activeElement.id'),'address-recipientName')
  await command('Page.captureScreenshot',{format:'png'}).then(async result=>{await import('node:fs/promises').then(fs=>fs.mkdir('.output/qa',{recursive:true}));await writeFile('.output/qa/form-errors-desktop.png',Buffer.from(result.data,'base64'))})
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(150)
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
  await command('Page.captureScreenshot',{format:'png'}).then(result=>writeFile('.output/qa/form-errors-mobile.png',Buffer.from(result.data,'base64')))
  await evaluate('document.querySelector("dialog[open]").dispatchEvent(new Event("cancel",{cancelable:true}))')
  await evaluate(`document.querySelector('a[href="/admin"]').click()`)
  await until(()=>evaluate('document.body.textContent.includes("Gestiona la tienda.")'))
  await click('Usuarios');await until(()=>userReads>0);await click('Registrar administrador')
  await until(()=>evaluate('!!document.querySelector("#admin-email")'))
  await evaluate('document.querySelector("#admin-email").closest("form").requestSubmit()');await sleep(150)
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'),/Motivo.*completa este campo/)
  await evaluate('document.querySelector("dialog[open]").dispatchEvent(new Event("cancel",{cancelable:true}))')
  await click('Inventario'); await until(()=>evaluate('document.body.textContent.includes("LOTE-SINTETICO")'))
  await click('Ajustar lote LOTE-SINTETICO'); await until(()=>evaluate('!!document.querySelector("#stock-delta")'))
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /retirar hasta 6 piezas/)
  await fill('stock-delta', '-7'); await fill('stock-reason', 'Ajuste sintético')
  await evaluate('document.querySelector("#stock-delta").closest("form").requestSubmit()'); await sleep(100)
  assert.equal(adjustmentWrites, 0)
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /retirar 6 piezas/)
  await fill('stock-delta', '-6')
  await evaluate('document.querySelector("#stock-delta").closest("form").requestSubmit()')
  await until(()=>adjustmentWrites === 1)
  await until(()=>evaluate('document.querySelector("dialog[open]").textContent.includes("retirar 1 pieza")'))
  await click('Actualizar existencias')
  await until(()=>evaluate('document.querySelector("#stock-delta").min === "-1"'))
  await fill('stock-delta', '-1')
  await evaluate('document.querySelector("#stock-delta").closest("form").requestSubmit()')
  await until(()=>evaluate('!document.querySelector("dialog[open]")'))
  assert.equal(adjustmentWrites, 2)
  assert.deepEqual(exceptions,[])
  console.log('Formularios en navegador: resumen completo, foco, campos vacíos, correo, longitud y bytes de contraseña visible, corrección de errores, dirección/CP, modal de administrador y ancho móvil correctos. APIs simuladas; sin registros reales.')
} finally {
  socket?.close();browser.kill()
  if(dirname(resolve(profile))!==resolve(tmpdir())||!basename(profile).startsWith('fitness-form-errors-'))throw Error('Directorio temporal inesperado.')
  await until(async()=>{await rm(profile,{recursive:true,force:true});return true}).catch(()=>{})
}
