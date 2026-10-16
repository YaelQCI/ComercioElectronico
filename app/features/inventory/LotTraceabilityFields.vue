<script setup>
defineProps({ draft: { type: Object, required: true }, prefix: { type: String, required: true }, disabled: Boolean })
</script>
<template>
  <UiField :id="`${prefix}-origin`" v-model="draft.origin" label="Origen (opcional)" maxlength="500" :disabled="disabled" />
  <UiField :id="`${prefix}-imported`" v-model="draft.importedOn" label="Fecha de importación (opcional)" type="date" :disabled="disabled" />
  <UiField :id="`${prefix}-customs`" v-model="draft.customsEntry" label="Aduana o registro de entrada (opcional)" maxlength="500" :disabled="disabled" />
</template>
