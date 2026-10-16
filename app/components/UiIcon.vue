<script setup>
defineProps({ name: { type: String, required: true } })
const paths = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M6 6l12 12M18 6 6 18',
  logout: 'M9 4H4v16h5M9 12h12M16 7l5 5-5 5',
  cart: 'M3 4h3l2.2 10.5h10L21 7H7M9 20h.01M17 20h.01',
  search: 'M15.5 15.5 21 21',
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
  card: 'M3 5h18v14H3V5Zm0 4h18M6 15h5',
  truck: 'M3 6h11v12H3V6Zm11 5h4l3 4v3h-7M7 18v2m11-2v2',
  box: 'm12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-8l1-7Z',
  tag: 'M3 3h8l10 10-8 8L3 11V3Zm5 5h.01',
  bag: 'M5 8h14l1 13H4L5 8Zm3 0V6a4 4 0 0 1 8 0v2',
  chart: 'M4 3v18h17M8 16v-5m5 5V6m5 10V9',
}
</script>
<template>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true" focusable="false">
    <circle v-if="name === 'search'" cx="10.5" cy="10.5" r="6.5" />
    <path :d="paths[name]" />
  </svg>
</template>
