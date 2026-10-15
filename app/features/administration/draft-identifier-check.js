// Descarta respuestas antiguas cuando el administrador cambia los identificadores.
export function createDraftIdentifierCheck(request, notify) {
  let revision = 0
  return {
    invalidate() { revision++ },
    async check(input) {
      const current = ++revision
      try {
        const result = await request(input)
        if (current !== revision) return null
        notify({ result, failure: '' })
        return result
      } catch {
        if (current === revision) notify({ result: null, failure: 'No pudimos comprobar los identificadores. Reintenta antes de crear el borrador.' })
        return null
      }
    },
  }
}
