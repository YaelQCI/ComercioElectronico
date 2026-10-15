<script setup>
import { useAdministration } from './useAdministration.js'
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/orders', { query: { page } })
const { busy, failure, message, save } = useAdministration(refresh)
const selected = ref(null), reason = ref(''), key = ref(''), detailBusy = ref(false)
const states = { PENDING_PAYMENT: 'Pendiente de pago', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELED: 'Cancelado', EXPIRED: 'Vencido' }
const payments = { PENDING: 'Pendiente', PAID: 'Pagado', NOT_REQUIRED: 'No requerido', PARTIALLY_REFUNDED: 'Reembolso parcial', REFUNDED: 'Reembolsado', FAILED: 'Fallido', RECONCILING: 'En conciliación' }
const next = { CONFIRMED: 'PREPARING', PREPARING: 'SHIPPED', SHIPPED: 'DELIVERED' }
watch(reason, () => { key.value = '' })
async function read(order) {
  if (detailBusy.value) return
  detailBusy.value = true; failure.value = ''; selected.value = null
  try { selected.value = (await $fetch(`/api/admin/orders/${order.id}`)).order; reason.value = ''; key.value = '' }
  catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos consultar el pedido.' }
  finally { detailBusy.value = false }
}
async function advance() {
  key.value ||= crypto.randomUUID()
  if (await save(`/api/admin/orders/${selected.value.id}/status`, { expectedStatus: selected.value.status, status: next[selected.value.status], reason: reason.value, idempotencyKey: key.value })) selected.value = null
}
const money = (cents, currency = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(Number(cents)/100)
</script>
<template>
  <div>
    <h2 class="text-display-m font-bold">Pedidos</h2><p class="mt-3 text-ink-2">Consulta el detalle y registra la preparación, el envío y la entrega de pedidos confirmados.</p>
    <p v-if="failure" role="alert" class="my-4 text-crit">{{ failure }}</p><p v-if="message" role="status" class="my-4 text-ok">{{ message }}</p>
    <UiLoading v-if="status === 'pending'" label="Cargando pedidos" />
    <div v-else-if="error" role="alert"><p>No se pudieron cargar los pedidos.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else>
      <p v-if="!data?.orders.length" class="my-6">No hay pedidos registrados.</p>
      <ul class="mt-6 grid gap-4"><li v-for="order in data?.orders" :key="order.id" class="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-surface p-4"><div><h3 class="font-semibold">Pedido {{ order.number }}</h3><p>{{ states[order.status] || order.status }} · {{ money(order.totalMoneyCents, order.currency) }}</p><p class="text-body-s text-ink-2">Pago: {{ payments[order.moneyStatus] || order.moneyStatus }}</p></div><UiButton variant="secondary" :disabled="busy || detailBusy" @click="read(order)">Ver pedido {{ order.number }}</UiButton></li></ul>
      <nav aria-label="Páginas de pedidos" class="my-4 flex items-center gap-4"><UiButton variant="secondary" :disabled="page <= 1 || busy" @click="page--">Anterior</UiButton><span>Página {{ page }} de {{ data?.pages || 1 }}</span><UiButton variant="secondary" :disabled="page >= (data?.pages || 1) || busy" @click="page++">Siguiente</UiButton></nav>
    </template>
    <UiLoading v-if="detailBusy" label="Consultando detalle" />
    <section v-if="selected" class="mt-6 rounded-sm border border-border p-4" aria-label="Detalle del pedido">
      <h3 class="text-display-s font-bold">Pedido {{ selected.number }}</h3><p class="my-3">{{ states[selected.status] || selected.status }}</p><p class="break-all">Cliente: {{ selected.buyerName }} · {{ selected.buyerEmail }}</p>
      <ul><li v-for="(line, index) in selected.lines" :key="index" class="my-2">{{ line.quantity }} × {{ line.name }} · {{ line.sku }} · {{ money(line.lineAfterCouponCents, selected.currency) }}</li></ul>
      <p class="my-3 font-semibold">Total: {{ money(selected.totalMoneyCents, selected.currency) }}</p>
      <div v-if="selected.address" class="my-4"><h4 class="font-semibold">Dirección de entrega</h4><p>{{ selected.address.recipientName }}</p><p>{{ selected.address.street }} {{ selected.address.exteriorNumber }} {{ selected.address.interiorNumber }}</p><p>{{ selected.address.district }}, {{ selected.address.city }}, {{ selected.address.state }}, {{ selected.address.postalCode }}</p></div>
      <h4 class="mt-4 font-semibold">Historial</h4><ul><li v-for="(item, index) in selected.history" :key="index">{{ states[item.status] || item.status }} · {{ new Date(item.date).toLocaleString('es-MX') }}</li></ul>
      <form v-if="next[selected.status] && ['PAID', 'NOT_REQUIRED', 'PARTIALLY_REFUNDED'].includes(selected.moneyStatus)" class="mt-6 grid gap-4" @submit.prevent="advance"><UiField id="order-reason" v-model="reason" label="Motivo del cambio de estado" required maxlength="500" /><UiButton type="submit" :disabled="busy">Marcar como {{ states[next[selected.status]].toLowerCase() }}</UiButton></form>
      <UiButton variant="secondary" class="mt-4" :disabled="busy" @click="selected = null">Cerrar detalle</UiButton>
    </section>
  </div>
</template>
