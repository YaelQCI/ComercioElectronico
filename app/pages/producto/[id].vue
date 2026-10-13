<script setup>
import ProductDetail from '~/features/catalog/ProductDetail.vue'
const route = useRoute()
</script>
<template><ProductDetail :key="route.params.id" :id="String(route.params.id)" /></template>
