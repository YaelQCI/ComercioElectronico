<script setup>
defineProps({ text: { type: String, required: true } })
const emit = defineEmits(['dismiss'])
let timer
function pause() { clearTimeout(timer) }
function resume() { pause(); timer = setTimeout(() => emit('dismiss'), 8000) }
onMounted(resume)
onBeforeUnmount(pause)
</script>
<template>
  <div class="pointer-events-auto flex items-start gap-3 rounded-sm border border-border bg-surface p-4 text-ink shadow-lg" @mouseenter="pause" @mouseleave="resume" @focusin="pause" @focusout="resume">
    <span aria-hidden="true" class="font-bold text-ok">✓</span>
    <p class="min-w-0 flex-1 break-words">{{ text }}</p>
    <button type="button" aria-label="Cerrar confirmación" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border" @click="emit('dismiss')">×</button>
  </div>
</template>
