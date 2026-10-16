import { filterKeys, parseCatalogFilters } from '~~/shared/features/catalog/filters.js'

export function useCatalogFilters(options, pending) {
  const route = useRoute()
  const minimum = ref(''), maximum = ref(''), rangeError = ref('')
  watch(() => route.fullPath, () => { minimum.value = typeof route.query.precioMin === 'string' ? route.query.precioMin : ''; maximum.value = typeof route.query.precioMax === 'string' ? route.query.precioMax : ''; rangeError.value = '' }, { immediate: true })
  const groups = computed(() => [
    { key: 'categoria', label: 'Categorías', options: options.value.categoria ?? [] },
    { key: 'objetivo', label: 'Objetivos', options: options.value.objetivo ?? [] },
    { key: 'disciplina', label: 'Disciplinas', options: options.value.disciplina ?? [] },
    { key: 'stock', label: 'Disponibilidad', options: [{ value: 'disponible', label: 'Disponible' }, { value: 'agotado', label: 'Agotado' }] },
    { key: 'porcion', label: 'Costo por porción', options: [{ value: 'menos-15', label: 'Menos de $15 MXN' }, { value: '15-30', label: 'De $15 a $30 MXN' }, { value: 'mas-30', label: 'Más de $30 MXN' }] },
    { key: 'presentacion', label: 'Presentaciones', options: options.value.presentacion ?? [] },
  ])
  const selected = key => Array.isArray(route.query[key]) ? route.query[key] : typeof route.query[key] === 'string' ? route.query[key].split(',').filter(Boolean) : []
  const chips = computed(() => groups.value.flatMap(group => selected(group.key).map(value => ({ key: group.key, value, label: group.options.find(o => o.value === value)?.label ?? value }))).concat(['precioMin', 'precioMax'].flatMap(key => route.query[key] ? [{ key, value: String(route.query[key]), label: `${key === 'precioMin' ? 'Desde' : 'Hasta'} $${route.query[key]} MXN` }] : [])))
  function navigate(next) { delete next.pagina; return navigateTo({ path: '/catalogo', query: next }) }
  function toggle(key, value) {
    if (pending.value) return
    const values = selected(key), nextValues = values.includes(value) ? values.filter(v => v !== value) : [...values, value]
    const next = { ...route.query }; if (nextValues.length) next[key] = nextValues; else delete next[key]
    navigate(next)
  }
  function remove(chip) { const next = { ...route.query }; if (['precioMin', 'precioMax'].includes(chip.key)) { delete next[chip.key]; navigate(next) } else toggle(chip.key, chip.value) }
  function clear() { const next = { ...route.query }; filterKeys.forEach(key => { delete next[key] }); navigate(next) }
  function applyRange() {
    const next = { ...route.query }
    if (minimum.value) next.precioMin = String(minimum.value); else delete next.precioMin
    if (maximum.value) next.precioMax = String(maximum.value); else delete next.precioMax
    try { parseCatalogFilters(next); rangeError.value = ''; navigate(next) } catch { rangeError.value = 'Revisa el rango: usa importes no negativos con dos decimales y mínimo menor o igual al máximo.' }
  }
  return reactive({ groups, chips, selected, toggle, remove, clear, minimum, maximum, rangeError, applyRange, pending })
}
