<script setup>
const props = defineProps({ src: String, alt: { type: String, required: true }, loading: { type: String, default: 'lazy' }, width: { type: Number, default: 600 }, height: { type: Number, default: 600 } })
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>
<template>
  <div class="flex h-full w-full items-center justify-center">
    <img v-if="src && !failed" :src="src" :alt="alt" :width="width" :height="height" :loading="loading" class="h-full w-full object-contain" @error="failed = true">
    <p v-else class="p-2 text-center text-body-s text-packshot-ink-2">Imagen no disponible<span v-if="alt">: {{ alt }}</span></p>
  </div>
</template>
