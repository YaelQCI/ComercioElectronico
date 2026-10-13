import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { themeBootstrap } from '../../app/features/appearance/theme.js'

function browser({ stored = null, dark = false, blocked = false } = {}) {
  const listeners = {}, mediaListeners = {}
  const storage = new Map(stored === null ? [] : [['fitness_theme', stored]])
  const media = { matches: dark, addEventListener: (key, fn) => { mediaListeners[key] = fn } }
  const root = { dataset: {} }
  const window = {
    matchMedia: () => media,
    localStorage: {
      getItem(key) { if (blocked) throw Error('denied'); return storage.get(key) ?? null },
      setItem(key, value) { if (blocked) throw Error('denied'); storage.set(key, value) },
      removeItem(key) { if (blocked) throw Error('denied'); storage.delete(key) },
    },
    addEventListener: (key, fn) => { listeners[key] = fn },
    dispatchEvent: () => {},
  }
  vm.runInNewContext(themeBootstrap, { window, document: { documentElement: root }, CustomEvent: class {} })
  return { root, window, storage, media, listeners, mediaListeners }
}
test('respeta el sistema y cambios posteriores sin preferencia manual', () => {
  const b = browser({ dark: true })
  assert.equal(b.root.dataset.theme, 'dark')
  b.media.matches = false; b.mediaListeners.change()
  assert.equal(b.root.dataset.theme, 'light')
})
test('restaura elección antes de hidratar y persiste cambios y regreso al sistema', () => {
  const b = browser({ stored: 'light', dark: true })
  assert.equal(b.root.dataset.theme, 'light')
  b.window.fitnessTheme.set('dark')
  assert.equal(b.storage.get('fitness_theme'), 'dark')
  b.media.matches = false; b.mediaListeners.change()
  assert.equal(b.root.dataset.theme, 'dark')
  b.window.fitnessTheme.set(null)
  assert.equal(b.storage.has('fitness_theme'), false)
  assert.equal(b.root.dataset.theme, 'light')
})
test('tolera almacenamiento bloqueado y valores inválidos', () => {
  const b = browser({ blocked: true, dark: true })
  b.window.fitnessTheme.set('light')
  assert.equal(b.root.dataset.theme, 'light')
  b.window.fitnessTheme.set('invalid')
  assert.equal(b.root.dataset.theme, 'light')
  assert.equal(browser({ stored: 'invalid', dark: true }).root.dataset.theme, 'dark')
})
test('sincroniza selección y eliminación entre pestañas', () => {
  const b = browser({ dark: true })
  b.listeners.storage({ key: 'fitness_theme', newValue: 'light' })
  assert.equal(b.root.dataset.theme, 'light')
  b.listeners.storage({ key: null, newValue: null })
  assert.equal(b.root.dataset.theme, 'dark')
})
