<script setup>
const props = defineProps({ open: Boolean, title: { type: String, required: true }, busy: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null), titleId = useId()
function close() { if (!props.busy) emit('close') }
watch(() => props.open, async (open) => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) dialog.value.showModal()
  else if (!open && dialog.value.open) dialog.value.close()
}, { immediate: true })
</script>
<template>
  <dialog ref="dialog" :aria-labelledby="titleId" :aria-busy="busy" class="ui-modal m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-sm border border-border bg-surface p-0 text-ink backdrop:bg-ink/60" @cancel.prevent="close">
    <div class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-4">
      <h2 :id="titleId" class="text-display-m font-bold">{{ title }}</h2>
      <UiButton variant="secondary" :disabled="busy" @click="close">Cerrar</UiButton>
    </div>
    <div v-if="open" class="p-5"><slot /></div>
  </dialog>
</template>
<style scoped>
:global(body:has(.ui-modal[open])) { overflow: hidden; }
</style>
