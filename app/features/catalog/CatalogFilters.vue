<script setup>
import { filterKeys, parseCatalogFilters } from '~~/shared/features/catalog/filters.js'
const props = defineProps({ options: { type: Object, default: () => ({}) }, pending: Boolean })
const route = useRoute()
const minimum = ref(''), maximum = ref(''), rangeError = ref('')
watch(() => route.fullPath, () => { minimum.value = typeof route.query.precioMin === 'string' ? route.query.precioMin : ''; maximum.value = typeof route.query.precioMax === 'string' ? route.query.precioMax : ''; rangeError.value = '' }, { immediate: true })
const groups = computed(() => [
  { key: 'categoria', label: 'Categorías', options: props.options.categoria ?? [] },
  { key: 'objetivo', label: 'Objetivos', options: props.options.objetivo ?? [] },
  { key: 'disciplina', label: 'Disciplinas', options: props.options.disciplina ?? [] },
  { key: 'stock', label: 'Disponibilidad', options: [{ value: 'disponible', label: 'Disponible' }, { value: 'agotado', label: 'Agotado' }] },
  { key: 'porcion', label: 'Costo por porción', options: [{ value: 'menos-15', label: 'Menos de $15 MXN' }, { value: '15-30', label: 'De $15 a $30 MXN' }, { value: 'mas-30', label: 'Más de $30 MXN' }] },
  { key: 'presentacion', label: 'Presentaciones', options: props.options.presentacion ?? [] },
])
const selected = key => Array.isArray(route.query[key]) ? route.query[key] : typeof route.query[key] === 'string' ? route.query[key].split(',').filter(Boolean) : []
const chips = computed(() => groups.value.flatMap(group => selected(group.key).map(value => ({ key: group.key, value, label: group.options.find(o => o.value === value)?.label ?? value }))).concat(['precioMin', 'precioMax'].flatMap(key => route.query[key] ? [{ key, value: String(route.query[key]), label: `${key === 'precioMin' ? 'Desde' : 'Hasta'} $${route.query[key]} MXN` }] : [])))
function navigate(next) { delete next.pagina; return navigateTo({ path: '/catalogo', query: next }) }
function toggle(key, value) {
  if (props.pending) return
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
</script>
<template>
  <aside aria-label="Filtros del catálogo" class="min-w-0">
    <details open class="rounded-sm border border-border bg-surface p-4">
      <summary class="min-h-11 cursor-pointer py-3 font-semibold">Filtros ({{ chips.length }})</summary>
      <div v-if="chips.length" class="my-3 space-y-2">
        <button v-for="chip in chips" :key="`${chip.key}:${chip.value}`" type="button" :disabled="pending" :aria-label="`Quitar filtro ${chip.label}`" class="mr-2 min-h-11 rounded-sm border border-border px-3 py-2 text-body-s" @click="remove(chip)">{{ chip.label }} <span aria-hidden="true">×</span></button>
        <button type="button" :disabled="pending" class="block min-h-11 text-accent-text underline" @click="clear">Limpiar filtros</button>
      </div>
      <fieldset v-for="group in groups" v-show="group.options.length" :key="group.key" :disabled="pending" class="mt-5 border-t border-line pt-4">
        <legend class="px-1 text-body-s font-semibold">{{ group.label }}</legend>
        <label v-for="option in group.options" :key="option.value" class="flex min-h-11 cursor-pointer items-center gap-3 text-body-s"><input type="checkbox" :checked="selected(group.key).includes(option.value)" :value="option.value" class="h-5 w-5" @change="toggle(group.key, option.value)"><span>{{ option.label }}</span></label>
      </fieldset>
      <form class="mt-5 space-y-3 border-t border-line pt-4" @submit.prevent="applyRange">
        <UiField id="minimum-price" v-model="minimum" label="Precio mínimo (MXN)" type="number" min="0" step="0.01" :disabled="pending" />
        <UiField id="maximum-price" v-model="maximum" label="Precio máximo (MXN)" type="number" min="0" step="0.01" :error="rangeError" :disabled="pending" />
        <UiButton type="submit" variant="secondary" :disabled="pending">Aplicar precios</UiButton>
      </form>
    </details>
  </aside>
</template>
