<script setup>
defineProps({ draft: { type: Object, required: true }, prefix: { type: String, required: true } })
const fields = [{ key: 'ingredients', label: 'Ingredientes (opcional)' }, { key: 'usageInstructions', label: 'Modo de uso (opcional)' }, { key: 'allergenInformation', label: 'Alérgenos (opcional)' }]
</script>
<template>
  <div v-for="field in fields" :key="field.key" class="md:col-span-2"><label :for="`${prefix}-${field.key}`" class="mb-2 block text-body-s font-semibold">{{ field.label }}</label><textarea :id="`${prefix}-${field.key}`" v-model="draft[field.key]" maxlength="10000" rows="3" class="w-full rounded-sm border border-border bg-surface p-3 text-ink" /></div>
</template>
