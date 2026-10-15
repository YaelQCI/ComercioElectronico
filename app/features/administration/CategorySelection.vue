<script setup>
const props = defineProps({ id: { type: String, required: true }, categories: { type: Array, default: () => [] }, currentCategories: { type: Array, default: () => [] } })
const model = defineModel({ type: Array, default: () => [] })
const available = computed(() => [...props.categories, ...props.currentCategories.filter(category => !props.categories.some(item => item.id === category.id)).map(category => ({ ...category, name: `${category.name} (inactiva; retírala antes de guardar)` }))])
const primary = computed({ get: () => model.value[0] || '', set: value => { model.value = value ? [value, ...model.value.filter(id => id !== value && id !== model.value[0])] : [] } })
function toggle(id) { model.value = model.value.includes(id) ? model.value.filter(value => value !== id) : [...model.value, id] }
</script>
<template>
  <fieldset class="min-w-0 rounded-sm border border-line p-4 md:col-span-2">
    <legend class="px-2 font-semibold">Clasificación del producto</legend>
    <UiField :id="id" v-model="primary" label="Tipo de suplemento / categoría principal" :options="[{ value: '', label: 'Sin clasificar' }, ...available.map(category => ({ value: category.id, label: category.name }))]" hint="Se utiliza en las categorías y filtros del catálogo. Puedes crear un tipo nuevo en Tipos de suplemento y categorías." />
    <p v-if="!categories.length" class="mt-3 text-body-s text-ink-2">Aún no hay tipos registrados. Crea únicamente las categorías que correspondan a tus productos.</p>
    <details v-if="available.length > 1 && primary" class="mt-3"><summary class="min-h-11 cursor-pointer text-body-s">Categorías adicionales (opcional)</summary><label v-for="category in available.filter(item => item.id !== primary)" :key="category.id" class="flex min-h-11 items-center gap-3 text-body-s"><input type="checkbox" :checked="model.includes(category.id)" @change="toggle(category.id)">{{ category.name }}</label></details>
  </fieldset>
</template>
