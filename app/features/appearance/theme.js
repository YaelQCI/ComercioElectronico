// Se ejecuta en <head> antes de pintar; también se prueba sin Vue/Nuxt.
export function initializeTheme() {
  const key = 'fitness_theme'
  const root = document.documentElement
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  let preference = null
  const valid = value => value === 'light' || value === 'dark'
  try { const stored = window.localStorage.getItem(key); if (valid(stored)) preference = stored } catch {}
  function apply() {
    const theme = preference || (media.matches ? 'dark' : 'light')
    root.dataset.theme = theme
    window.dispatchEvent(new CustomEvent('fitness-theme', { detail: { theme, preference } }))
    return theme
  }
  window.fitnessTheme = {
    get: () => ({ theme: root.dataset.theme, preference }),
    set(value) {
      if (value !== null && !valid(value)) return
      preference = value
      try {
        if (value === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, value)
      } catch {}
      apply()
    },
  }
  media.addEventListener('change', () => { if (!preference) apply() })
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue) ? event.newValue : null
      apply()
    }
  })
  apply()
}

export const themeBootstrap = `(${initializeTheme.toString()})();`
