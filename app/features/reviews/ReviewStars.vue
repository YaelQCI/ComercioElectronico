<script setup>
defineProps({ rating: { type: Number, required: true } })
const id = useId()
</script>
<template>
  <span class="inline-flex gap-1 text-accent-text" role="img" :aria-label="`${rating} de 5 estrellas`">
    <svg v-for="star in 5" :key="star" class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
      <defs><clipPath :id="`${id}-star-${star}`"><rect :width="24 * Math.max(0, Math.min(1, rating - star + 1))" height="24" /></clipPath></defs>
      <path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L2.9 9.6l6.3-.9Z" />
      <path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L2.9 9.6l6.3-.9Z" fill="currentColor" :clip-path="`url(#${id}-star-${star})`" />
    </svg>
  </span>
</template>
