<script setup>
import { imagesForVariant } from '~~/shared/features/catalog/product-images.js'
const props = defineProps({ images: { type: Array, required: true }, variantId: String })
const applicable = computed(() => imagesForVariant(props.images, props.variantId))
const activeId = ref('')
watch([applicable, () => props.variantId], ([images, variantId], previous) => { if (variantId !== previous?.[1] || !images.some(i => i.id === activeId.value)) activeId.value = (images.find(i => i.kind === 'FRONT') ?? images[0])?.id ?? '' }, { immediate: true })
const active = computed(() => applicable.value.find(i => i.id === activeId.value))
function move(delta) {
  const images = applicable.value
  if (!images.length) return
  const index = images.findIndex(image => image.id === activeId.value)
  activeId.value = images[(index + delta + images.length) % images.length].id
}
</script>
<template>
  <section aria-label="Galería del producto" class="grid min-w-0 items-start gap-3" @keydown.left.prevent="move(-1)" @keydown.right.prevent="move(1)">
    <figure class="relative min-w-0">
      <div class="aspect-[4/3] overflow-hidden rounded-sm border border-line bg-packshot p-4 md:p-6"><Transition name="gallery" mode="out-in"><UiImage :key="active?.id ?? 'empty'" :src="active?.url" :alt="active?.alt ?? 'Producto seleccionado'" loading="eager" /></Transition></div>
      <div v-if="applicable.length > 1" class="pointer-events-none absolute inset-0 flex items-center justify-between px-2"><button type="button" aria-label="Imagen anterior" class="pointer-events-auto flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-packshot-line bg-packshot text-packshot-ink focus-visible:outline-packshot-ink" @click="move(-1)"><span aria-hidden="true">‹</span></button><button type="button" aria-label="Imagen siguiente" class="pointer-events-auto flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-packshot-line bg-packshot text-packshot-ink focus-visible:outline-packshot-ink" @click="move(1)"><span aria-hidden="true">›</span></button></div>
      <figcaption v-if="active" class="sr-only" aria-live="polite">{{ active.alt }}</figcaption>
    </figure>
    <div v-if="applicable.length > 1" class="flex gap-3 overflow-x-auto p-1" role="group" aria-label="Seleccionar imagen">
      <button v-for="image in applicable" :key="image.id" type="button" :aria-label="`Mostrar ${image.alt}`" :aria-pressed="activeId === image.id" class="h-20 w-20 shrink-0 rounded-sm border bg-packshot p-1" :class="activeId === image.id ? 'border-accent outline-2 outline-accent' : 'border-line'" @click="activeId = image.id"><UiImage :src="image.url" alt="" :width="80" :height="80" /></button>
    </div>
  </section>
</template>
<style scoped>
@media (prefers-reduced-motion:no-preference) {
  .gallery-enter-active,.gallery-leave-active { transition:opacity 100ms ease; }
  .gallery-enter-from,.gallery-leave-to { opacity:0; }
}
</style>
