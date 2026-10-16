// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-catalog-layout-'))
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

  const live=await(await fetch(base+'/api/catalog/products')).json()
  if(!live.products?.[0])throw Error('Se requiere un producto publicado como referencia.')
  const products=Array.from({length:25},(_,index)=>({...structuredClone(live.products[0]),id:'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),name:'Producto de prueba '+(index+1)}))
  const options={...live.options,objetivo:[{value:'fuerza',label:'Fuerza'}],disciplina:[{value:'running',label:'Running'}]}
  const originalMessage=socket.onmessage
  socket.onmessage=event=>{
    originalMessage(event)
    const message=JSON.parse(event.data)
    if(message.method!=='Fetch.requestPaused')return
    const {requestId,request}=message.params
    const url=new URL(request.url),page=Number(url.searchParams.get('pagina')||1)
    const start=(page-1)*12
    const payload={...live,options,products:products.slice(start,start+12),total:25,catalogTotal:25,pages:3,page,pageSize:12,start:start+1,end:Math.min(start+12,25)}
    void command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(payload)).toString('base64')})
  }
  const ready=async()=>{await sleep(150);return until(()=>evaluate('!!document.querySelector("[data-catalog-grid]") && !document.querySelector("[data-loading-skeleton]") && !document.querySelector("[data-page-loading]")'))}
  async function setField(id,value,event='input'){
    await evaluate('(()=>{const field=document.getElementById('+JSON.stringify(id)+');field.value='+JSON.stringify(value)+';field.dispatchEvent(new Event('+JSON.stringify(event)+',{bubbles:true}))})()')
  }
  await command('Page.enable');await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride',{width:1912,height:1100,deviceScaleFactor:1,mobile:false})
  await command('Page.navigate',{url:base+'/cuenta'})
  await until(()=>evaluate('!!document.querySelector("#header-search")'));await sleep(1200)
  await command('Fetch.enable',{patterns:[{urlPattern:'*/api/catalog/products*'}]})
  await setField('header-search','fixture')
  await evaluate('document.querySelector("#header-search").closest("form").requestSubmit()');await ready()
  assert.equal(await evaluate('document.querySelectorAll("[data-product-card]").length'),12)
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-catalog-grid]")).gridTemplateColumns.split(" ").length'),4)
  assert.equal(await evaluate('document.querySelectorAll("aside fieldset").length'),7)
  await setField('catalog-order','precio-asc','change');await ready()
  await evaluate('document.querySelector(\'nav[aria-label^="Pagin"] a[href*="pagina=2"]\').click()');await ready()
  assert.ok((await evaluate('location.search')).includes('pagina=2'))
  await evaluate('document.querySelector("aside input[value=fuerza]").click()');await ready()
  const filtered=await evaluate('location.search')
  assert.ok(filtered.includes('objetivo=fuerza'));assert.ok(filtered.includes('q=fixture'));assert.ok(filtered.includes('orden=precio-asc'));assert.ok(!filtered.includes('pagina='))
  assert.ok(await evaluate('!!document.querySelector(\'[aria-label="Filtros activos"] button[aria-label="Quitar filtro Fuerza"]\')'))
  await setField('minimum-price','100');await setField('maximum-price','2000')
  await evaluate('document.querySelector("#minimum-price").closest("form").requestSubmit()');await ready()
  assert.ok((await evaluate('location.search')).includes('precioMin=100'))
  for(const theme of ['dark','light']){
    await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));await sleep(250)
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
    if(process.env.TEST_CATALOG_SCREENSHOT_DIRECTORY){
      const metrics=await command('Page.getLayoutMetrics')
      const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1912,height:Math.ceil(metrics.cssContentSize.height),scale:1}})
      await writeFile(join(process.env.TEST_CATALOG_SCREENSHOT_DIRECTORY,'fitness-catalog-'+theme+'.png'),Buffer.from(shot.data,'base64'))
    }
  }
  await evaluate('document.querySelector(\'[aria-label="Filtros activos"] button[aria-label="Quitar filtro Fuerza"]\').click()');await ready()
  assert.ok(!(await evaluate('location.search')).includes('objetivo='))
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Limpiar filtros").click()');await ready()
  const cleared=await evaluate('location.search');assert.ok(cleared.includes('q=fixture'));assert.ok(cleared.includes('orden=precio-asc'));assert.ok(!cleared.includes('precioMin='))
  await setField('minimum-price','1000');await setField('maximum-price','1')
  await evaluate('document.querySelector("#minimum-price").closest("form").requestSubmit()')
  assert.ok(await evaluate('!!document.querySelector("aside [role=alert]")'))
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});await sleep(200)
  await evaluate('document.querySelector("aside details").open=false')
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
  if(process.env.TEST_CATALOG_SCREENSHOT_DIRECTORY){await evaluate('window.scrollTo(0,0)');const shot=await command('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.TEST_CATALOG_SCREENSHOT_DIRECTORY,'fitness-catalog-mobile.png'),Buffer.from(shot.data,'base64'))}
  await command('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await sleep(200)
  assert.equal(await evaluate('document.querySelector("aside details").open'),true)
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
  console.log('Catálogo: distribución, filtros actuales, etiquetas activas, rango, orden, paginación, parámetros de búsqueda, temas y adaptación correctos. Respuestas simuladas; sin cambios de datos.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-catalog-layout-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
