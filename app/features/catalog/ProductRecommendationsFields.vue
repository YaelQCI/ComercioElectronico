<script setup>
const props = defineProps({ edit: { type: Object, required: true }, productId: String, names: { type: Array, default: () => [] }, disabled: Boolean })
const q = ref(''), search = ref('')
let timer
watch(q, value => { clearTimeout(timer); timer = setTimeout(() => { search.value = value }, 250) })
onScopeDispose(() => clearTimeout(timer))
const { data, status, error, refresh } = await useFetch('/api/admin/catalog/options', { query: { q: search } })
const known = reactive({})
watch(() => props.names, value => { for (const item of value) known[item.id] = item.name }, { immediate: true })
watch(data, value => { for (const item of value?.products ?? []) known[item.id] = item.name }, { immediate: true })
const groups = [{ key: 'relatedProductIds', label: 'También te puede servir (ficha del producto)' }, { key: 'crossSellProductIds', label: 'Súmalo a tu pedido (carrito)' }]
function move(key, index, delta) { const list = props.edit[key], target = index + delta; if (target < 0 || target >= list.length) return; [list[index], list[target]] = [list[target], list[index]] }
</script>
<template>
  <fieldset :disabled="disabled" class="min-w-0 rounded-sm border border-line p-4 md:col-span-2">
    <legend class="px-2 font-semibold">Recomendaciones</legend>
    <UiField :id="`recommendation-search-${productId || 'draft'}`" v-model="q" label="Buscar productos por nombre o SKU" maxlength="120" />
    <p class="my-3 text-body-s text-ink-2">Hasta ocho productos por grupo. El orden de la lista define su aparición. Solo los productos publicados y activos serán visibles para los clientes.</p>
    <p v-if="error" role="alert">No pudimos buscar productos. <button type="button" class="underline" @click="refresh">Reintentar</button></p>
    <p v-if="status === 'pending'" role="status" class="text-body-s text-ink-2">Buscando productos…</p>
    <div class="grid gap-6 md:grid-cols-2"><div v-for="group in groups" :key="group.key" class="min-w-0">
      <h4 class="mb-3 font-semibold">{{ group.label }}</h4>
      <ol class="mb-4 grid gap-2"><li v-for="(id, index) in edit[group.key]" :key="id" class="rounded-sm border border-line p-2 text-body-s"><p>{{ index + 1 }}. {{ known[id] || id }}</p><div class="mt-2 flex flex-wrap gap-2"><UiButton variant="secondary" :disabled="index === 0 || disabled" @click="move(group.key, index, -1)">Subir</UiButton><UiButton variant="secondary" :disabled="index === edit[group.key].length - 1 || disabled" @click="move(group.key, index, 1)">Bajar</UiButton><UiButton variant="secondary" @click="edit[group.key].splice(index, 1)">Quitar</UiButton></div></li></ol>
      <div class="max-h-64 overflow-y-auto"><label v-for="item in data?.products.filter(item => item.id !== productId && !edit[group.key].includes(item.id)) ?? []" :key="item.id" class="flex min-h-11 cursor-pointer items-center gap-3 text-body-s"><input type="checkbox" :disabled="disabled || edit[group.key].length >= 8 || status === 'pending'" class="h-5 w-5 shrink-0 accent-accent" @change="edit[group.key].push(item.id)"><span>{{ item.name }}{{ item.published ? '' : ' (borrador)' }}</span></label></div>
    </div></div>
    <p v-if="data?.hasMore" class="mt-3 text-body-s text-ink-2">Hay más coincidencias. Escribe un nombre o SKU más específico.</p>
  </fieldset>
</template>
