<script setup>
const props = defineProps({ disabled: Boolean })
const model = defineModel({ type: String, default: '' })
const input = ref(null), searching = ref(false), query = ref(''), selected = ref(null)
const results = ref([]), pending = ref(false), failure = ref(''), hasMore = ref(false), active = ref(-1)
const id = useId(), listId = `${id}-results`
let timer, controller, revision = 0
watchEffect(() => input.value?.setCustomValidity(model.value ? '' : 'Selecciona una variante de los resultados.'))
watch(model, sku => { if (!sku) selected.value = null })
watch(() => props.disabled, disabled => { if (disabled) close() })
function cancel() { clearTimeout(timer); controller?.abort(); revision++; pending.value = false }
function search() {
  cancel(); results.value = []; failure.value = ''; hasMore.value = false; active.value = -1
  if (query.value.trim().length < 2) return
  pending.value = true
  const current = revision, text = query.value
  timer = setTimeout(async () => {
    controller = new AbortController()
    try {
      const data = await $fetch('/api/admin/inventory/variants', { query: { q: text }, signal: controller.signal })
      if (current !== revision) return
      results.value = data.variants; hasMore.value = data.hasMore
      if (model.value && !selected.value) {
        selected.value = data.variants.find(variant => variant.sku === model.value) ?? null
        if (selected.value) query.value = selected.value.productName
      }
    } catch (error) {
      if (current === revision) failure.value = error.data?.statusMessage ?? 'No pudimos buscar productos. Intenta de nuevo.'
    } finally { if (current === revision) pending.value = false }
  }, 300)
}
function begin() {
  if (props.disabled || searching.value) return
  searching.value = true
  query.value = selected.value?.productName ?? model.value
  search()
}
function change(event) { query.value = event.target.value; model.value = ''; selected.value = null; searching.value = true; search() }
function choose(variant) { if (props.disabled) return; selected.value = variant; model.value = variant.sku; searching.value = false; cancel() }
function close() { searching.value = false; cancel() }
function leave(event) { if (!event.currentTarget.contains(event.relatedTarget)) close() }
function keyboard(event) {
  if (event.key === 'Escape' && searching.value) { event.preventDefault(); event.stopPropagation(); close(); return }
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    if (!searching.value) { begin(); return }
    if (results.value.length) {
      active.value = active.value < 0 ? (event.key === 'ArrowDown' ? 0 : results.value.length - 1) : (active.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length
      nextTick(() => document.getElementById(`${id}-option-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
    }
  }
  if (event.key === 'Enter' && searching.value) {
    event.preventDefault()
    if (active.value >= 0 && results.value[active.value]) choose(results.value[active.value])
  }
}
onBeforeUnmount(cancel)
</script>
<template>
  <div class="relative" @focusout="leave">
    <label :for="id" class="mb-2 block text-body-s font-semibold">Producto / SKU de la variante</label>
    <input :id="id" ref="input" :value="searching ? query : model" :disabled="disabled" required maxlength="120" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="searching" :aria-controls="listId" :aria-activedescendant="searching && active >= 0 ? `${id}-option-${active}` : undefined" :aria-describedby="`${id}-hint ${id}-status`" class="min-h-11 w-full rounded-sm border border-border bg-surface px-3 py-2 text-ink disabled:bg-off-soft" @focus="begin" @click="begin" @input="change" @keydown="keyboard">
    <p :id="`${id}-hint`" class="mt-2 text-body-s text-ink-2">Busca por nombre o SKU y selecciona una variante. Al volver al campo verás el nombre del producto.</p>
    <div v-if="searching" class="mt-2 rounded-sm border border-border bg-surface p-2">
      <p :id="`${id}-status`" role="status" class="p-2 text-body-s text-ink-2">{{ pending ? 'Buscando…' : failure || (query.trim().length < 2 ? 'Escribe al menos dos caracteres.' : !results.length ? 'No se encontraron variantes activas.' : `${results.length} resultados${hasMore ? '; escribe más para afinar la búsqueda' : ''}.`) }}</p>
      <ul :id="listId" role="listbox" aria-label="Variantes del producto" class="max-h-64 overflow-y-auto">
        <li v-for="(variant, index) in results" :id="`${id}-option-${index}`" :key="variant.id" role="option" :aria-selected="active === index" class="cursor-pointer rounded-sm border border-transparent p-3" :class="active === index ? 'border-border bg-surface-2' : 'hover:bg-surface-2'" @pointerdown.prevent @click="choose(variant)">
          <span class="block font-semibold">{{ variant.productName }}</span>
          <span class="block text-body-s">{{ variant.sku }} · {{ variant.flavor }} · {{ variant.presentationLabel }}</span>
        </li>
      </ul>
      <UiButton v-if="failure" variant="secondary" class="mt-2" @pointerdown.prevent @click="search">Reintentar búsqueda</UiButton>
    </div>
    <span v-else :id="`${id}-status`" class="sr-only">{{ model ? `SKU seleccionado: ${model}` : 'Sin variante seleccionada' }}</span>
  </div>
</template>
