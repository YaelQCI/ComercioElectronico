// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-index-design-'))
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

  const realHome=await (await fetch(base+'/api/catalog/home')).json()
  if(!realHome.featured?.[0])throw Error('Se requiere un producto destacado para la comprobaci?n visual.')
  const featured=Array.from({length:8},(_,index)=>{
    const product=structuredClone(realHome.featured[0])
    product.id='00000000-0000-4000-8000-'+String(index+1).padStart(12,'0')
    product.name='Producto de prueba '+(index+1)
    product.variants=[{...product.variants[0],availableQty:index===2?0:10}]
    return product
  })
  const originalMessage=socket.onmessage
  socket.onmessage=event=>{
    originalMessage(event)
    const message=JSON.parse(event.data)
    if(message.method!=='Fetch.requestPaused')return
    void command('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({...realHome,featured})).toString('base64')})
  }
  await command('Page.enable');await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride',{width:1912,height:1080,deviceScaleFactor:1,mobile:false})
  await command('Page.navigate',{url:base+'/cuenta'})
  await until(()=>evaluate('!!document.querySelector("header a")'));await sleep(1200)
  await command('Fetch.enable',{patterns:[{urlPattern:'*/api/catalog/home'}]})
  await evaluate('document.querySelector("header a").click()')
  await until(()=>evaluate('document.querySelectorAll("[data-product-card]").length===8 && !document.querySelector("[data-page-loading]")'))
  assert.ok(await evaluate('document.querySelector("#home-benefits-heading") && document.querySelector("#categories-heading") && document.querySelector("#price-guarantee-heading")'))
  const grid=await evaluate('getComputedStyle(document.querySelector("[data-product-card]").parentElement).gridTemplateColumns.split(" ").length')
  assert.equal(grid,4)
  const colors=[]
  for(const theme of ['light','dark']){
    await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme))
    await sleep(300)
    colors.push(await evaluate('getComputedStyle(document.querySelector("section[aria-labelledby=home-heading]")).backgroundColor'))
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
    if(process.env.TEST_INDEX_SCREENSHOT_DIRECTORY){
      const metrics=await command('Page.getLayoutMetrics')
      const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1912,height:Math.ceil(metrics.cssContentSize.height),scale:1}})
      await writeFile(join(process.env.TEST_INDEX_SCREENSHOT_DIRECTORY,'fitness-index-'+theme+'.png'),Buffer.from(shot.data,'base64'))
    }
  }
  assert.notEqual(colors[0],colors[1])
  await evaluate('window.__guaranteeButton=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Leer condiciones");window.__guaranteeButton.focus();window.__guaranteeButton.click()')
  await until(()=>evaluate('!!document.querySelector("dialog[open]")'))
  assert.ok(await evaluate('!!document.querySelector(\'dialog[open] a[href="/contacto"]\')'))
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await until(()=>evaluate('!document.querySelector("dialog[open]")'))
  await until(()=>evaluate('document.activeElement===window.__guaranteeButton'))
  assert.ok(await evaluate('!document.querySelectorAll("[data-product-card]")[2].querySelector("button[aria-label]")'))
  await evaluate('document.querySelectorAll("[data-product-card]")[2].querySelector("details summary").click()')
  assert.ok(await evaluate('document.querySelectorAll("[data-product-card]")[2].querySelector("details").open'))
  await evaluate('document.querySelectorAll("[data-product-card]")[2].querySelector("details summary").click()')
  for(const width of [390,768,1280]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768})
    await sleep(200)
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
  }
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true})
  await evaluate('window.scrollTo(0,0)')
  if(process.env.TEST_INDEX_SCREENSHOT_DIRECTORY){const shot=await command('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.TEST_INDEX_SCREENSHOT_DIRECTORY,'fitness-index-mobile.png'),Buffer.from(shot.data,'base64'))}
  await evaluate('document.querySelector("section[aria-labelledby=categories-heading] a").click()')
  await until(()=>evaluate('location.pathname==="/catalogo" && location.search.includes("categoria=" )'))
  console.log('Inicio: ocho tarjetas simuladas, cuatro columnas, colores por tema, condiciones y foco del modal, navegación por categoría y anchos móvil/tablet/escritorio correctos. Sin cambios de datos.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-index-design-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
