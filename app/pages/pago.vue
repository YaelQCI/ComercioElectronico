<script setup>
import PaymentStatus from '~/features/payments/PaymentStatus.vue'
const route=useRoute()
const id=computed(()=>typeof route.query.pedido==='string'?route.query.pedido:'')
useHead({title:'Estado del pago — The Fitness Stuff'})
</script>
<template><PaymentStatus :key="id" :order-id="id" :returned-from-cancel="route.query.cancelado==='1'"/></template>
