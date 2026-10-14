<script setup>
import { imagesForVariant } from '~~/shared/features/catalog/product-images.js'
const props = defineProps({ images: { type: Array, required: true }, variantId: String })
const applicable = computed(() => imagesForVariant(props.images, props.variantId))
const activeId = ref('')
watch(applicable, images => { if (!images.some(i => i.id === activeId.value)) activeId.value = (images.find(i => i.kind === 'FRONT') ?? images[0])?.id ?? '' }, { immediate: true })
const active = computed(() => applicable.value.find(i => i.id === activeId.value))
</script>
<template>
  <section aria-label="Galería del producto" class="min-w-0">
    <figure>
      <div class="aspect-square rounded-sm border border-line bg-packshot p-6"><Transition name="gallery" mode="out-in"><UiImage :key="active?.id ?? 'empty'" :src="active?.url" :alt="active?.alt ?? 'Producto seleccionado'" loading="eager" /></Transition></div>
      <figcaption v-if="active" class="mt-3 text-body-s text-ink-2" aria-live="polite">{{ active.alt }}</figcaption>
    </figure>
    <div v-if="applicable.length > 1" class="mt-4 flex flex-wrap gap-3" role="group" aria-label="Seleccionar imagen">
      <button v-for="image in applicable" :key="image.id" type="button" :aria-label="`Mostrar ${image.alt}`" :aria-pressed="activeId === image.id" class="h-20 w-20 rounded-sm border bg-packshot p-2" :class="activeId === image.id ? 'border-ink outline-2 outline-offset-2 outline-ink' : 'border-border'" @click="activeId = image.id"><UiImage :src="image.url" alt="" :width="80" :height="80" /></button>
    </div>
  </section>
</template>
<style scoped>
@media (prefers-reduced-motion:no-preference) {
  .gallery-enter-active,.gallery-leave-active { transition:opacity 100ms ease; }
  .gallery-enter-from,.gallery-leave-to { opacity:0; }
}
</style>
