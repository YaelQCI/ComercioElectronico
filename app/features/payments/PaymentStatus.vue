<script setup>
import { formatMXN } from '~~/shared/features/pricing/prices.js'
import { usePaymentStatus } from './usePaymentStatus.js'
import { paymentPresentation, orderStatusLabels, moneyStatusLabels } from './payment-presentation.js'
const props = defineProps({ orderId: { type: String, required: true }, returnedFromCancel: Boolean })
const { data, busy, failure, updatedAt, consult, cancel, resume } = usePaymentStatus(props.orderId)
const { data: session } = useNuxtData('account-session')
const presentation = computed(() => failure.value && !data.value ? { kind: 'warning', title: 'No pudimos consultar tu compra', description: 'Intenta actualizar el estado en un momento. Tu pedido conserva su información.' } : paymentPresentation(data.value))
const success = computed(() => presentation.value.kind === 'success')
const canResume = computed(() => data.value?.status === 'PENDING_PAYMENT' && !data.value.needsReview && !['PAID', 'RECONCILING', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(data.value.moneyStatus))
function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Consulta el estado del intento' : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-10 md:px-8 md:py-14">
    <UiBreadcrumbs :items="[{ label: 'Estado del pago' }]" />
    <h1 class="mt-6 text-display-m font-bold">Estado de tu compra</h1>
    <div class="mx-auto mt-6 max-w-3xl overflow-hidden rounded-sm border border-line bg-surface">
      <div class="px-5 py-9 text-center md:px-10 md:py-12" :class="success ? 'bg-ok-soft' : 'bg-surface-2'">
        <div v-if="success" class="payment-success mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-ok bg-surface text-ok" aria-hidden="true">
          <svg viewBox="0 0 80 80" class="h-20 w-20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle class="payment-ring" cx="40" cy="40" r="32" pathLength="1" stroke-width="2" /><path class="payment-check" d="m24 40 11 11 23-24" pathLength="1" stroke-width="5" /></svg>
        </div>
        <div v-else class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-surface text-ink-2" aria-hidden="true"><svg viewBox="0 0 48 48" class="h-10 w-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="24" cy="24" r="18" /><path v-if="presentation.kind === 'pending'" d="M24 13v12l8 5" /><path v-else-if="presentation.kind === 'refund'" d="m19 17-6 6 6 6m-6-6h14a8 8 0 0 1 0 16" /><path v-else d="M24 14v12m0 8v1" /></svg></div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <p v-if="success" class="mb-3 text-body-s font-semibold text-ok">{{ data.moneyStatus === 'PAID' ? 'Pago validado' : 'Pedido confirmado' }}</p>
          <h2 class="text-display-l font-bold">{{ presentation.title }}</h2>
          <p class="mx-auto mt-4 max-w-xl text-ink-2">{{ presentation.description }}</p>
        </div>
      </div>
      <div class="px-5 py-6 md:px-10 md:py-8">
        <p v-if="failure" role="alert" class="mb-5 rounded-sm border border-crit bg-crit-soft p-4 text-crit">{{ failure }}<span v-if="data" class="mt-1 block text-body-s">Mostramos el último estado consultado.</span></p>
        <p v-if="returnedFromCancel && canResume" class="mb-5 text-body-s text-ink-2">Regresaste sin terminar el pago. Puedes reanudar el intento o cerrarlo.</p>
        <template v-if="data">
          <div class="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6"><div><p class="text-body-s text-ink-2">{{ success && data.moneyStatus === 'PAID' ? 'Total pagado' : 'Importe del pedido' }}</p><p class="mt-1 font-mono text-display-m font-bold">{{ formatMXN(data.totalMoneyCents) }}</p></div><span class="rounded-full border px-3 py-1 text-body-s font-semibold" :class="success ? 'border-ok text-ok' : 'border-border text-ink-2'">{{ moneyStatusLabels[data.moneyStatus] ?? 'Estado en revisión' }}</span></div>
          <dl class="mt-6 grid min-w-0 gap-5 sm:grid-cols-2"><div class="min-w-0 sm:col-span-2"><dt class="text-body-s text-ink-2">Número de pedido</dt><dd class="mt-1 break-all font-mono text-body-s">{{ data.number }}</dd></div><div><dt class="text-body-s text-ink-2">Estado del pedido</dt><dd class="mt-1 font-semibold">{{ orderStatusLabels[data.status] ?? 'En revisión' }}</dd></div><div v-if="updatedAt"><dt class="text-body-s text-ink-2">Última actualización</dt><dd class="mt-1">{{ dateLabel(updatedAt) }}</dd></div><div v-if="data.expiresAt && data.status === 'PENDING_PAYMENT'" class="sm:col-span-2"><dt class="text-body-s text-ink-2">Plazo de este intento de pago</dt><dd class="mt-1">{{ dateLabel(data.expiresAt) }}</dd></div></dl>
          <p v-if="data.cardRejected" role="alert" class="mt-5 text-crit">La tarjeta fue rechazada. Revisa el intento antes de volver a pagar.</p>
          <div v-if="canResume" class="mt-6 flex flex-wrap gap-3"><UiButton :disabled="busy" @click="resume">Reanudar pago</UiButton><UiButton variant="secondary" :disabled="busy" @click="cancel">Cerrar intento</UiButton></div>
          <div class="mt-8 flex flex-wrap gap-3 border-t border-line pt-6"><UiButton v-if="session?.user" to="/pedidos">Ver mis pedidos</UiButton><UiButton to="/catalogo" :variant="session?.user ? 'secondary' : 'primary'">{{ success ? 'Seguir comprando' : 'Explorar productos' }}</UiButton><UiButton v-if="!success" to="/carrito" variant="secondary">Volver al carrito</UiButton></div>
        </template>
        <div class="mt-5 flex flex-wrap items-center justify-between gap-3"><p class="max-w-md text-body-s text-ink-2">{{ busy ? 'Actualizando el estado de tu compra…' : 'El estado se actualiza al volver a esta pestaña.' }}</p><UiButton variant="secondary" :disabled="busy" @click="consult">{{ busy ? 'Actualizando…' : 'Actualizar estado' }}</UiButton></div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.payment-success { animation: payment-appear .45s ease-out both; }
.payment-ring { stroke-dasharray: 1; animation: payment-draw .65s ease-out both; }
.payment-check { stroke-dasharray: 1; animation: payment-draw .4s .4s ease-out both; }
@keyframes payment-appear { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: scale(1); } }
@keyframes payment-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .payment-success, .payment-ring, .payment-check { animation: none; } }
</style>
