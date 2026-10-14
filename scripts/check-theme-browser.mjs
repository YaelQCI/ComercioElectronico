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
  let loadEvents = 0
  let registrationRequests = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.loadEventFired') loadEvents++
    if (message.method === 'Network.requestWillBeSent' && message.params.request.method === 'POST' && new URL(message.params.request.url).pathname === '/api/account/register') registrationRequests++
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
  if(process.env.TEST_LAYOUT_AUDIT==='true'){
    const routes=['/','/catalogo?q=sin-resultados-sinteticos','/carrito','/checkout','/cuenta','/pedidos','/solicitudes','/politicas/devoluciones','/contacto']
    const report=[]
    for(const theme of ['light','dark'])for(const width of [360,480,768,1100])for(const route of routes){
      await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768})
      const load=loadEvents
      await command('Page.navigate',{url:base+route})
      await until(()=>loadEvents>load);await loaded()
      if(await evaluate('document.documentElement.dataset.theme')!==theme)await click(`Usar tema ${theme==='light'?'claro':'oscuro'}`)
      await until(()=>evaluate(`document.documentElement.dataset.theme === '${theme}'`))
      const result=await evaluate(`(()=>{
        const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
        const controls=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea')].filter(visible).map(e=>e.matches('input[type=checkbox],input[type=radio]')&&e.labels?.length?e.labels[0]:e);
        return {scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,overflowElements:[...document.querySelectorAll("body *")].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0}).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,60)})),overflow:document.documentElement.scrollWidth>innerWidth+1,missingAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,smallControls:controls.filter(e=>{const r=e.getBoundingClientRect();return r.width<44||r.height<44}).map(e=>({tag:e.tagName,type:e.type,text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,60)})),title:document.title,h1:document.querySelector('h1')?.textContent.trim(),brokenPage:document.title.includes('404')};
      })()`)
      report.push({theme,width,route,...result})
    }
    if(process.env.TEST_AUDIT_PATH)await writeFile(process.env.TEST_AUDIT_PATH,JSON.stringify(report,null,2))
    console.log(`Auditoría: ${report.length} escenarios; desbordamientos ${report.filter(r=>r.overflow).length}; páginas 404 ${report.filter(r=>r.brokenPage).length}; imágenes sin alt ${report.reduce((s,r)=>s+r.missingAlt,0)}; controles pequeños ${report.reduce((s,r)=>s+r.smallControls.length,0)}. Informe requiere revisión, no equivale a auditoría WCAG completa.`)
    assert.ok(report.every(r=>!r.overflow),'Hay desbordamientos horizontales; revisar informe.')
    assert.ok(report.every(r=>!r.missingAlt),'Hay imágenes sin atributo alt.')
  }
  if(process.env.TEST_CATALOG_INTERACTIONS==='true'){
    const open=async path=>{const count=loadEvents;await command('Page.navigate',{url:base+path});await until(()=>loadEvents>count);await loaded()}
    const settled=()=>until(()=>evaluate(`!!document.querySelector('#catalog-order')&&!document.querySelector('[aria-busy="true"]')`))
    await open('/catalogo?orden=precio-asc&pagina=2');await settled()
    await evaluate(`document.querySelector('#header-search').focus()`)
    await command('Input.insertText',{text:'sin-resultados-sinteticos-auditoria'})
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
    await until(()=>evaluate(`new URL(location.href).searchParams.get('q')==='sin-resultados-sinteticos-auditoria'&&!new URL(location.href).searchParams.has('pagina')`));await settled()
    assert.equal(await evaluate(`new URL(location.href).searchParams.get('orden')`),'precio-asc')
    assert.ok(await evaluate(`document.body.textContent.includes('No encontramos productos')`))
    await evaluate(`document.querySelector('input[type=checkbox][value=disponible]').click()`)
    await until(()=>evaluate(`new URL(location.href).searchParams.get('stock')==='disponible'`));await settled()
    assert.ok(await evaluate(`document.querySelector('button[aria-label="Quitar filtro Disponible"]')!==null`))
    await evaluate(`document.querySelector('button[aria-label="Quitar filtro Disponible"]').click()`)
    await until(()=>evaluate(`!new URL(location.href).searchParams.has('stock')`));await settled()
    assert.equal(await evaluate(`document.querySelector('input[type=checkbox][value=disponible]').checked`),false)
    let count=loadEvents;await command('Page.reload');await until(()=>loadEvents>count);await loaded();await settled()
    assert.equal(await evaluate(`document.querySelector('#header-search').value`),'sin-resultados-sinteticos-auditoria')
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Limpiar búsqueda y filtros').click()`)
    await until(()=>evaluate(`!new URL(location.href).searchParams.has('q')`));await settled()
    assert.equal(await evaluate(`document.querySelector('#header-search').value`),'')
    const next=await evaluate(`document.querySelector('nav[aria-label="Paginación del catálogo"] a:last-child')?.getAttribute('href')`)
    assert.ok(next,'La base aislada debe contener más de doce productos de prueba publicados.')
    await evaluate(`document.querySelector('nav[aria-label="Paginación del catálogo"] a:last-child').click()`)
    await until(()=>evaluate(`new URL(location.href).searchParams.get('pagina')==='2'`));await settled()
    await evaluate(`const e=document.querySelector('#catalog-order');e.value='precio-desc';e.dispatchEvent(new Event('change',{bubbles:true}))`)
    await until(()=>evaluate(`new URL(location.href).searchParams.get('orden')==='precio-desc'&&!new URL(location.href).searchParams.has('pagina')`));await settled()
    await evaluate('history.back()');await until(()=>evaluate(`new URL(location.href).searchParams.get('pagina')==='2'`));await settled()
    console.log('Catálogo: búsqueda por Enter, preservación orden/reset página, sin resultados, checkbox/chip, recarga, limpiar, paginación, orden y navegación atrás correctos. Datos sintéticos.')
  }
  if(process.env.TEST_REGISTRATION_CONFIRMATION==='true'){
    await command('Network.enable')
    const load=loadEvents;await command('Page.navigate',{url:base+'/cuenta'});await until(()=>loadEvents>load);await loaded()
    await until(()=>evaluate(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Crear cuenta')`))
    await click('Crear cuenta')
    await until(()=>evaluate(`!!document.querySelector('#account-password-confirmation')`))
    const type=async(id,value)=>{await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.focus();e.select()})()`);await command('Input.insertText',{text:value})}
    await type('account-name','Prueba sintética de confirmación')
    await type('account-email','confirmacion-browser@example.invalid')
    await type('account-password','Contraseña de prueba 123')
    await type('account-password-confirmation','Otra contraseña de prueba')
    await click('Registrarme')
    await until(()=>evaluate(`document.getElementById('account-password-confirmation').getAttribute('aria-invalid')==='true'&&document.body.textContent.includes('Las contraseñas no coinciden.')`))
    assert.equal(await evaluate('document.activeElement.id'),'account-password-confirmation')
    assert.equal(registrationRequests,0,'No enviar un registro inválido al servidor.')
    await type('account-password-confirmation','Contraseña de prueba 123')
    await until(()=>evaluate(`!document.getElementById('account-password-confirmation').hasAttribute('aria-invalid')`))
    assert.equal(await evaluate(`document.querySelector('[role=alert]')?.textContent.includes('Las contraseñas no coinciden.')??false`),false)
    assert.equal(await evaluate(`document.getElementById('account-password-confirmation').getAttribute('autocomplete')`),'new-password')
    await click('Iniciar sesión')
    await until(()=>evaluate(`!document.getElementById('account-password-confirmation')`))
    await click('Crear cuenta')
    await until(()=>evaluate(`document.getElementById('account-password-confirmation')?.value===''`))
    const rejected=await evaluate(`(async()=>{
      const statuses=[];
      for(const confirmation of [undefined,'','Contraseña diferente']){
        const response=await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'confirmacion-http@example.invalid',displayName:'Prueba sintética',password:'Contraseña de prueba 123',passwordConfirmation:confirmation})});
        statuses.push(response.status);
      }
      return statuses;
    })()`)
    assert.deepEqual(rejected,[400,400,400])
    console.log('Registro browser: confirmación obligatoria, discrepancia anunciada/foco, envío bloqueado, corrección de error y campo exclusivo del registro correctos. No se creó cuenta.')
  }
  console.log('Navegador: sistema, selección, recarga, navegación Nuxt, vuelta al sistema y móvil correctos.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-theme-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
