// Todas las renovaciones pasan por el mismo bloqueo entre pestañas.
export function createSessionFetch({ fetch: originalFetch, origin, lock, now = Date.now, onSession = () => {} }) {
  let pending, lastSession, nextCheck = 0, generation = 0
  const excluded = new Set(['/api/account/login', '/api/account/register', '/api/account/logout', '/api/account/refresh'])
  const readSession = () => originalFetch(`${origin}/api/account/session`, { credentials: 'same-origin', cache: 'no-store' })
  async function check() {
    if (pending) return pending
    if (now() < nextCheck) return lastSession
    pending = (async () => {
      const run = async () => {
        const response = await readSession()
        if (!response.ok) throw new Error('No se pudo comprobar la sesión.')
        let session = await response.json()
        if (!session.user && session.refreshAvailable && lock) {
          const renewed = await originalFetch(`${origin}/api/account/refresh`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
          if (!renewed.ok && renewed.status !== 401) throw new Error('No se pudo renovar la sesión.')
          if (renewed.ok) {
            const current = await readSession()
            if (!current.ok) throw new Error('No se pudo comprobar la sesión renovada.')
            session = await current.json()
            generation++
          }
        }
        const expires = Date.parse(session.accessExpiresAt)
        nextCheck = session.user && Number.isFinite(expires) ? Math.max(now(), expires - 5000) : now() + 60000
        lastSession = session
        onSession(session)
        return session
      }
      return lock ? lock(run) : run()
    })().finally(() => { pending = undefined })
    return pending
  }
  async function request(input, options) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, origin)
    if (url.origin !== origin || !url.pathname.startsWith('/api/')) return originalFetch(input, options)
    if (excluded.has(url.pathname)) {
      // La renovación manual usa también el bloqueo para no consumir dos veces la credencial.
      if (url.pathname === '/api/account/refresh' && lock) return lock(async () => {
        const current = await readSession()
        if (current.ok && (await current.clone().json()).user) return current
        nextCheck = 0
        return originalFetch(input, options)
      })
      const response = await originalFetch(input, options)
      nextCheck = 0
      return response
    }
    options?.signal?.throwIfAborted()
    await check()
    options?.signal?.throwIfAborted()
    const previousGeneration = generation
    const replay = input instanceof Request ? input.clone() : input
    const response = await originalFetch(input, options)
    if (response.status !== 401 || options?.body instanceof ReadableStream) return response
    // Un único reintento si el 401 se resuelve con una renovación real.
    nextCheck = 0
    await check()
    if (generation === previousGeneration) return response
    options?.signal?.throwIfAborted()
    return originalFetch(replay, options)
  }
  return { fetch: request, check, invalidate: () => { nextCheck = 0 } }
}
