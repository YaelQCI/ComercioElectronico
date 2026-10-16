<script setup>
import { imagesForVariant } from '~~/shared/features/catalog/product-images.js'
const props = defineProps({ images: { type: Array, required: true }, variantId: String, to: [String, Object], productName: String })
const images = computed(() => imagesForVariant(props.images, props.variantId))
const front = computed(() => images.value.find(i => i.kind === 'FRONT'))
const back = computed(() => images.value.find(i => i.kind === 'NUTRITION'))
const hovered = ref(false), focused = ref(false)
const showBack = computed(() => !!back.value && (hovered.value || focused.value))
watch(() => props.variantId, () => { hovered.value = false; focused.value = false })
function focusPreview(event) { focused.value = event.target.matches(':focus-visible') }
</script>
<template>
  <div class="relative z-10 aspect-[4/3] overflow-hidden bg-packshot" data-packshot :data-preview="showBack ? 'nutrition' : 'front'" @pointerenter="event => { if (event.pointerType === 'mouse') hovered = true }" @pointerleave="event => { if (event.pointerType === 'mouse') hovered = false }">
    <div class="packshot-layer absolute inset-0 p-4" :class="{ 'packshot-hidden': showBack }" :aria-hidden="showBack"><UiImage :src="front?.url" :alt="front?.alt ?? productName ?? 'Producto'" /></div>
    <div v-if="back" class="packshot-layer absolute inset-0 p-4" :class="{ 'packshot-hidden': !showBack }" :aria-hidden="!showBack"><UiImage :src="back.url" :alt="back.alt ?? 'Información nutrimental'" /></div>
    <NuxtLink v-if="to" :to="to" :aria-label="`Ver ${productName || 'producto'}`" class="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-packshot-ink" @focus="focusPreview" @blur="focused = false" />
  </div>
</template>
<style scoped>
.packshot-layer { opacity:1; filter:blur(0); pointer-events:none; }
.packshot-hidden { opacity:0; filter:blur(5px); }
@media (prefers-reduced-motion:no-preference) {
  .packshot-layer { transition:opacity 280ms ease,filter 280ms ease; }
}
</style>
