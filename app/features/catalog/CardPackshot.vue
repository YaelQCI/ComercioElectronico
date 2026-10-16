<script setup>
import { imagesForVariant } from '~~/shared/features/catalog/product-images.js'
const props = defineProps({ images: { type: Array, required: true }, variantId: String, to: [String, Object], productName: String })
const images = computed(() => imagesForVariant(props.images, props.variantId))
const front = computed(() => images.value.find(i => i.kind === 'FRONT'))
const back = computed(() => images.value.find(i => i.kind === 'NUTRITION'))
const showBack = ref(false)
const current = computed(() => showBack.value && back.value ? back.value : front.value)
watch(() => props.variantId, () => { showBack.value = false })
function focusPreview(event) { if (event.target.matches(':focus-visible')) showBack.value = true }
</script>
<template>
  <div class="relative z-10 aspect-[4/3] bg-packshot p-4" @pointerenter="event => { if (event.pointerType === 'mouse') showBack = true }" @pointerleave="event => { if (event.pointerType === 'mouse') showBack = false }">
    <NuxtLink v-if="to" :to="to" :aria-label="`Ver ${productName || 'producto'}`" class="absolute inset-0 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-packshot-ink"><UiImage :src="current?.url" :alt="current?.alt ?? 'Producto'" /></NuxtLink>
    <UiImage v-else :src="current?.url" :alt="current?.alt ?? 'Producto'" />
    <button v-if="back" type="button" class="absolute bottom-2 left-2 z-10 min-h-11 rounded-sm border border-packshot-line bg-packshot px-3 py-2 text-body-s text-packshot-ink focus-visible:outline-packshot-ink" :aria-pressed="showBack" @focus="focusPreview" @blur="showBack = false" @click="showBack = !showBack">{{ showBack ? 'Ver frente' : 'Ver información nutrimental' }}</button>
  </div>
</template>
