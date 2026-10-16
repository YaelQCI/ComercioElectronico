// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-review-stars-'))
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

  let savedRating = null
  const originalMessage = socket.onmessage
  socket.onmessage = event => {
    originalMessage(event)
    const message = JSON.parse(event.data)
    if (message.method !== 'Fetch.requestPaused') return
    const { requestId, request } = message.params
    let payload
    if (request.method === 'POST') { savedRating = JSON.parse(request.postData).rating; payload = { hidden: false } }
    else if (request.url.endsWith('/mine')) payload = { review: { rating: 3, title: 'Fixture', body: 'Synthetic review' } }
    else payload = { total: 10, average: 4.2, distribution: {5: 6, 4: 2, 3: 1, 2: 0, 1: 1}, pages: 1, reviews: [{id:'fixture', author:'Fixture',rating:5,title:'Test',body:'Synthetic review',createdAt:'2026-10-16T00:00:00.000Z'}] }
    void command('Fetch.fulfillRequest', {requestId, responseCode:200, responseHeaders:[{name:'Content-Type',value:'application/json'}], body:Buffer.from(JSON.stringify(payload)).toString('base64')})
  }
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Fetch.enable', {patterns:[{urlPattern:'*/api/reviews/products/*'}]})
  await command('Page.navigate', {url:base+'/catalogo'})
  await until(() => evaluate(`!!document.querySelector('a[href^="/producto/"]')`))
  await sleep(1200)
  await evaluate(`document.querySelector('a[href^="/producto/"]').click()`)
  await until(() => evaluate(`!!document.querySelector('input[type="radio"]')`))
  await until(() => evaluate(`document.querySelector('section[aria-label="Reseñas verificadas"]').textContent.includes('60%')`))
  const summary = await evaluate(`document.querySelector('section[aria-label="Reseñas verificadas"]').textContent`)
  assert.ok(summary.includes('60%'))
  assert.ok(summary.includes('20%'))
  await evaluate(`document.querySelector('input[type="radio"]').closest('details').open=true`)
  assert.equal(await evaluate(`document.querySelectorAll('input[type="radio"]').length`),5)
  for (const value of ['1','3','5']) {
    await evaluate(`document.querySelector('input[type="radio"][value="${value}"]').click()`)
    assert.equal(await evaluate(`document.querySelector('input[type="radio"]:checked').value`),value)
    assert.equal(await evaluate(`[...document.querySelectorAll('input[type="radio"]')].filter(r=>r.closest('label').querySelector('svg').getAttribute('fill')==='currentColor').length`),Number(value))
  }
  await evaluate(`document.querySelector('input[type="radio"][value="3"]').focus()`)
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
  assert.equal(await evaluate(`document.querySelector('input[type="radio"]:checked').value`),'4')
  await evaluate('const field=document.querySelector("#review-body");field.value="Synthetic review";field.dispatchEvent(new Event("input",{bubbles:true}));field.closest("form").requestSubmit()')
  await until(() => savedRating === 4)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true)
  if (process.env.TEST_REVIEW_SCREENSHOT) {
    await evaluate(`document.querySelector('section[aria-label="Reseñas verificadas"]').scrollIntoView()`)
    const shot = await command('Page.captureScreenshot', {format:'png'})
    await writeFile(process.env.TEST_REVIEW_SCREENSHOT, Buffer.from(shot.data, 'base64'))
  }
  console.log('Reviews: percentages, five stars, pointer selection, keyboard, submitted rating and mobile width passed. All review APIs mocked; no reviews published.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-review-stars-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
