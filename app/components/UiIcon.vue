<script setup>
defineProps({ name: { type: String, required: true } })
const paths = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M6 6l12 12M18 6 6 18',
  cart: 'M3 4h3l2.2 10.5h10L21 7H7M9 20h.01M17 20h.01',
  search: 'M15.5 15.5 21 21',
}
</script>
<template>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true" focusable="false">
    <circle v-if="name === 'search'" cx="10.5" cy="10.5" r="6.5" />
    <path :d="paths[name]" />
  </svg>
</template>
