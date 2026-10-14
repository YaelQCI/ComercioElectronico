<script setup>
import PolicyPage from '~/features/policies/PolicyPage.vue'
const route = useRoute()
</script>
<template>
  <PolicyPage :key="route.params.slug" :slug="route.params.slug" />
</template>
