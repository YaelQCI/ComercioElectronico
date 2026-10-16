// Chrome/Edge headless con CDP; sin dependencia adicional de automatización.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'

const base = process.env.TEST_HTTP_URL
const executable = process.env.TEST_BROWSER_PATH
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base ?? '') || !executable) throw Error('Configura TEST_HTTP_URL local y TEST_BROWSER_PATH con Chrome o Edge.')
const profile = await mkdtemp(join(tmpdir(), 'fitness-error-toasts-'))
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

  await command('Page.enable')
  await command('Page.navigate', {url: base + '/catalogo?q=prueba-sin-resultados'})
  await until(() => evaluate("!!document.querySelector('[data-toast-region]')"))
  const hasToast = text => evaluate('Array.from(document.querySelectorAll("[data-toast-region] [role=alert]")).some(el=>el.textContent.includes('+JSON.stringify(text)+'))')
  await evaluate(`window.testAlert=document.createElement('div');testAlert.setAttribute('role','alert');testAlert.textContent='Error sintetico de interfaz';document.body.append(testAlert)`)
  await until(() => hasToast('Error sintetico de interfaz'))
  await evaluate(`window.duplicateAlert=testAlert.cloneNode(true);document.body.append(duplicateAlert)`)
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-toast-region] [role=alert]')].filter(el=>el.textContent.includes('Error sintetico de interfaz')).length`),1)
  await evaluate(`testAlert.textContent='Error sintetico actualizado'`)
  await until(() => hasToast('Error sintetico actualizado'))
  await evaluate(`document.querySelectorAll('[data-toast-region] button').forEach(b=>b.click());document.body.classList.add('test-notification')`)
  await sleep(100)
  assert.equal(await hasToast('Error sintetico actualizado'),false)
  await evaluate(`window.hiddenAlert=document.createElement('p');hiddenAlert.hidden=true;hiddenAlert.setAttribute('role','alert');hiddenAlert.textContent='Error sintetico oculto';document.body.append(hiddenAlert)`)
  await sleep(100)
  assert.equal(await hasToast('Error sintetico oculto'),false)
  await evaluate('hiddenAlert.hidden=false')
  await until(() => hasToast('Error sintetico oculto'))
  await evaluate(`window.testDialog=document.createElement('dialog');testDialog.innerHTML='<p role="alert">Error sintetico modal<button type="button">Reintentar</button></p>';document.body.append(testDialog);testDialog.showModal()`)
  await until(() => evaluate(`[...testDialog.querySelectorAll('[data-toast-region] [role=alert] p')].some(el=>el.textContent==='Error sintetico modal')`))
  assert.equal(await evaluate(`[...testDialog.querySelectorAll('[data-toast-region] [role=alert] p')].some(el=>el.textContent.includes('Reintentar'))`),false)
  await evaluate(`testDialog.close();testDialog.remove();testAlert.remove();duplicateAlert.remove();hiddenAlert.remove();document.querySelectorAll('[data-toast-region] button').forEach(b=>b.click());window.testForm=document.createElement('form');testForm.innerHTML='<label for="test-required">Correo de prueba</label><input id="test-required" type="email" required>';document.body.append(testForm);testForm.reportValidity()`)
  await until(() => hasToast('Correo de prueba: Completa este campo.'))
  await command('Page.navigate', {url: base + '/pagina-sintetica-inexistente-notificaciones'})
  await until(() => hasToast('Revisa la direcci\u00f3n o explora los productos del cat\u00e1logo.'))
  assert.equal(await evaluate('document.body.textContent.includes("stack trace")'),false)
  console.log('Toasts en navegador: aparicion, duplicados, actualizacion, cierre sin bucle, errores ocultos, modal, validacion nativa y p\u00e1gina 404 correctos. Sin escrituras de negocio.')
} finally {
  socket?.close()
  browser.kill()
  if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('fitness-error-toasts-')) throw Error('Directorio temporal inesperado.')
  await until(async () => { await rm(profile, { recursive: true, force: true }); return true }).catch(() => {})
}
