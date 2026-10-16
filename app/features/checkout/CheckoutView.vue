<script setup>
import StartPayment from '~/features/payments/StartPayment.vue'
import ShippingCalculator from '~/features/shipping/ShippingCalculator.vue'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
import { mexicanStates } from '~~/shared/features/shipping/mexican-states.js'
import { hasCurrentShippingQuote } from './shipping-selection.js'
const { data: cart, error, refresh } = await useFetch('/api/cart', { key: 'store-cart' })
const selectedQuote = useState('cart-selected-quote', () => null)
const quote = computed(() => selectedQuote.value?.cartVersion === cart.value?.version ? selectedQuote.value : null)
const quoteClock = ref(Date.now())
const quoteReady = computed(() => hasCurrentShippingQuote(quote.value, cart.value?.version, quoteClock.value))
let quoteTimer
const { data: session } = useNuxtData('account-session')
const step = ref(1), heading = ref(null), email = ref(''), accepted = ref(false), busy = ref(false), failure = ref(''), order = ref(null)
const key = ref(''), previousRequest = ref('')
const firstStep = ref(null)
const address = reactive({ recipientName: '', phone: '', postalCode: '', state: '', city: '', district: '', street: '', exteriorNumber: '', interiorNumber: '' })
const fields = [
  { key: 'district', label: 'Colonia' },
  { key: 'exteriorNumber', label: 'Número exterior' },
  { key: 'interiorNumber', label: 'Número interior (opcional)', optional: true },
]
const total = computed(() => cart.value?.totals && quote.value ? (BigInt(cart.value.totals.goodsMoneyCents) + BigInt(quote.value.chargedAmountCents)).toString() : null)
const ready = computed(() => !!cart.value?.lines.length && !cart.value.lines.some(line => !line.stockSufficient))
const stateName = computed(() => mexicanStates.find(state => state.value === address.state)?.label ?? address.state)
onMounted(() => {
  email.value = session.value?.user?.email ?? ''
  watch(quote, value => {
    clearTimeout(quoteTimer)
    quoteClock.value = Date.now()
    if (!hasCurrentShippingQuote(value, cart.value?.version, quoteClock.value)) return
    const deadline = Math.min(Date.parse(value.quotedAt) + 600001, value.expiresAt == null ? Infinity : Date.parse(value.expiresAt))
    quoteTimer = setTimeout(() => { quoteClock.value = Date.now() }, Math.max(1, deadline - quoteClock.value))
  }, { immediate: true })
})
onBeforeUnmount(() => clearTimeout(quoteTimer))
function destinationChanged(d) { Object.assign(address, { recipientName: d.name, phone: d.phone, postalCode: d.postalCode, state: d.state, city: d.city, street: d.street }); accepted.value = false }
function addressSelected(value) { for (const key of ['district', 'exteriorNumber', 'interiorNumber']) address[key] = value?.[key] ?? '' }
watch(step, async () => { await nextTick(); heading.value?.focus() })
watch(quote, value => {
  if (!value && step.value === 2) { step.value = 1; accepted.value = false; failure.value = 'El carrito o la dirección cambiaron. Cotiza y acepta nuevamente el envío.' }
})
function review() {
  if (!hasCurrentShippingQuote(quote.value, cart.value?.version)) { failure.value = 'Para continuar, cotiza el envío y acepta una tarifa vigente.'; return }
  if (!firstStep.value?.querySelector('form')?.reportValidity()) return
  failure.value = ''; accepted.value = false; step.value = 2
}
async function confirm() {
  if (busy.value || !accepted.value || !ready.value || order.value) return
  if (!hasCurrentShippingQuote(quote.value, cart.value?.version)) { step.value = 1; accepted.value = false; failure.value = 'La tarifa ya no está vigente. Cotiza y acepta nuevamente el envío antes de confirmar.'; return }
  const body = { email: email.value, address: { ...address }, accepted: true, quoteId: quote.value.id, cartVersion: cart.value.version, expectedTotalCents: total.value }
  const signature = JSON.stringify(body)
  if (signature !== previousRequest.value) { key.value = crypto.randomUUID(); previousRequest.value = signature }
  busy.value = true; failure.value = ''
  try {
    order.value = await $fetch('/api/checkout/prepare', { method: 'POST', body: { ...body, idempotencyKey: key.value } })
    step.value = 3
  } catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos confirmar tu pedido. Tus datos siguen disponibles para reintentar.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-12 md:px-8">
    <UiBreadcrumbs :items="[{ label: 'Carrito', to: '/carrito' }, { label: 'Continuar con la compra' }]" />
    <h1 class="text-display-l font-bold">Continuar con la compra</h1>
    <nav aria-label="Pasos de compra" class="mt-6"><ol class="grid gap-3 sm:grid-cols-3"><li v-for="(label, index) in ['Cotizar envío', 'Confirmar pedido', 'Pago']" :key="label" :aria-current="step === index + 1 ? 'step' : undefined" class="rounded-sm border p-3" :class="step === index + 1 ? 'border-ink bg-surface font-semibold' : 'border-line text-ink-2'"><span class="font-mono">{{ index + 1 }}.</span> {{ label }}<span v-if="step > index + 1" class="sr-only">, completado</span></li></ol></nav>
    <div v-if="error" role="alert" class="mt-6"><p>Carrito no disponible.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <p v-else-if="!order && !ready" role="status" class="mt-6">Agrega productos y revisa las existencias en el carrito para continuar.</p>
    <div v-else class="mt-8 max-w-3xl">
      <h2 ref="heading" tabindex="-1" class="text-display-m font-bold">{{ ['Cotizar envío', 'Confirmar pedido', 'Pago'][step - 1] }}</h2>
      <p v-if="failure" role="alert" class="my-4 text-crit">{{ failure }}</p>
      <div v-show="step === 1" ref="firstStep" class="mt-6">
        <ShippingCalculator :version="cart.version" :disabled="busy" @destination-change="destinationChanged" @address-selected="addressSelected">
          <template #additional-fields>
          <UiField id="checkout-email" v-model="email" label="Correo de compra" type="email" autocomplete="email" required maxlength="254" />
          <UiField v-for="field in fields" :id="`checkout-${field.key}`" :key="field.key" v-model="address[field.key]" :label="field.label" :type="field.type ?? 'text'" :options="field.options" :pattern="field.pattern" :autocomplete="field.autocomplete" :required="!field.optional" :maxlength="field.maxlength ?? 200" />
          </template>
        </ShippingCalculator>
        <p id="checkout-shipping-requirement" class="mt-4 text-body-s text-ink-2">{{ quoteReady ? 'Tarifa aceptada. Puedes continuar a confirmar tu pedido.' : 'Para habilitar el botón, cotiza el envío y acepta una tarifa vigente.' }} Cambiar la dirección requiere volver a cotizar.</p>
        <UiButton class="mt-6" :disabled="busy || !quoteReady" aria-describedby="checkout-shipping-requirement" @click="review">Continuar a confirmar pedido</UiButton>
      </div>
      <form v-if="step === 2" class="mt-6 space-y-6" @submit.prevent="confirm">
        <section aria-label="Productos del pedido" class="rounded-sm border border-line bg-surface p-4"><h3 class="font-semibold">Productos</h3><ul class="mt-3 space-y-3"><li v-for="line in cart.lines" :key="line.id"><p>{{ line.name }} · {{ line.presentation }}</p><p class="text-body-s">{{ line.quantity }} × {{ formatMXN(line.unitPriceCents) }} MXN</p></li></ul></section>
        <section v-if="quote" aria-label="Datos de entrega" class="rounded-sm border border-line bg-surface p-4"><h3 class="font-semibold">Contacto y entrega</h3><p class="mt-3">{{ email }}</p><p>{{ address.recipientName }} · {{ address.phone }}</p><p>{{ address.street }}<span v-if="address.interiorNumber"> · Interior {{ address.interiorNumber }}</span></p><p>{{ address.district }}, {{ address.city }}, {{ stateName }} · C.P. {{ address.postalCode }}</p><p class="mt-3">{{ quote.carrierCode }} · {{ quote.serviceName }}</p></section>
        <dl v-if="quote" class="grid grid-cols-2 gap-3 rounded-sm border border-line bg-surface p-4"><dt>Productos después de descuentos</dt><dd class="text-right">{{ formatMXN(cart.totals.goodsMoneyCents) }} MXN</dd><dt>Envío</dt><dd class="text-right">{{ formatMXN(quote.chargedAmountCents) }} MXN</dd><dt class="font-semibold">Total</dt><dd class="text-right font-semibold">{{ formatMXN(total) }} MXN</dd></dl>
        <div class="flex flex-wrap gap-4"><NuxtLink v-for="slug in ['privacidad', 'terminos', 'devoluciones']" :key="slug" :to="`/politicas/${slug}`" class="inline-flex min-h-11 items-center text-accent-text underline">{{ slug }}</NuxtLink></div>
        <label class="flex min-h-11 items-center gap-3"><input v-model="accepted" type="checkbox" required :disabled="busy">Acepto las políticas publicadas y el importe mostrado.</label>
        <p class="text-body-s text-ink-2">Al confirmar se registra tu pedido pendiente de pago. Las existencias se reservarán al iniciar el pago.</p>
        <div class="flex flex-wrap gap-3"><UiButton type="submit" :disabled="busy || !accepted">{{ busy ? 'Confirmando…' : 'Confirmar pedido y continuar al pago' }}</UiButton><UiButton variant="secondary" :disabled="busy" @click="step = 1; failure = ''">Editar datos</UiButton></div>
      </form>
      <div v-else-if="order" class="mt-6">
        <p role="status">Pedido registrado: <strong>{{ order.number }}</strong></p>
        <p class="mt-2 font-mono">Total: {{ formatMXN(order.totalMoneyCents) }} {{ order.currency }}</p>
        <p class="mt-2 text-body-s text-ink-2">Pendiente de pago. Tu compra se confirmará cuando se verifique el pago.</p>
        <StartPayment v-if="order.paymentEnabled" :order-id="order.orderId" :guest-token="order.guestToken" :total-money-cents="order.totalMoneyCents" />
        <p v-else role="status" class="mt-4">El pago todavía no está habilitado. Tu pedido está registrado y pendiente de pago.</p>
        <NuxtLink to="/pedidos" class="mt-4 inline-flex min-h-11 items-center text-accent-text underline">Consultar pedidos de mi cuenta</NuxtLink>
      </div>
    </div>
    <NuxtLink to="/carrito" class="mt-6 inline-flex min-h-11 items-center text-accent-text underline">Volver al carrito</NuxtLink>
  </section>
</template>
