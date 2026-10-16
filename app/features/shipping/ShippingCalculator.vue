<script setup>
import { postalCode } from '~~/shared/features/shipping/shipping-policy.js'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
import { mexicanStates } from '~~/shared/features/shipping/mexican-states.js'
import { savedDestination } from '~~/shared/features/shipping/saved-destination.js'
const stateOptions = [{ value: '', label: 'Selecciona un estado' }, ...mexicanStates]
const props = defineProps({ version: { type: Number, required: true }, disabled: Boolean })
const selected = useState('cart-selected-quote', () => null)
const query = computed(() => ({ version: props.version }))
const { data: initial } = await useFetch('/api/shipping/selected', { query })
if (initial.value?.selected?.cartVersion === props.version) selected.value = initial.value.selected
else selected.value = null
const destination = reactive({ name: '', phone: '', street: '', city: '', state: '', country: 'MX', postalCode: '', ...(selected.value?.destination ?? {}) })
const pending = ref(false), error = ref(''), notice = ref(''), choices = ref([])
const { data: session } = useNuxtData('account-session')
const addresses = ref([]), addressChoice = ref(''), addressesPending = ref(false), addressesError = ref('')
const addressOptions = computed(() => [{ value: '', label: 'Escribir otra dirección' }, ...addresses.value.map(address => ({ value: address.id, label: `${address.label || address.recipientName} · ${address.street} ${address.exteriorNumber}, ${address.city} · C.P. ${address.postalCode}${address.isDefault ? ' (Predeterminada)' : ''}` }))])
let addressGeneration = 0, destinationEdited = false, applyingAddress = false
function chooseAddress(id) {
  const address = addresses.value.find(item => item.id === id)
  applyingAddress = true
  Object.assign(destination, address ? savedDestination(address) : { name: '', phone: '', street: '', city: '', state: '', country: 'MX', postalCode: '' })
  applyingAddress = false
  addressChoice.value = address?.id ?? ''
  if (address && !destination.state) notice.value = 'Revisa el estado de tu dirección guardada y selecciónalo antes de cotizar.'
}
async function loadAddresses() {
  const userId = session.value?.user?.id
  if (!userId) return
  const current = ++addressGeneration
  addressesPending.value = true; addressesError.value = ''
  try {
    const profile = await $fetch('/api/account/profile')
    if (current !== addressGeneration || session.value?.user?.id !== userId) return
    addresses.value = profile.addresses
    if (!destinationEdited && !selected.value && !Object.entries(destination).some(([key, value]) => key !== 'country' && value)) {
      const preferred = addresses.value.find(address => address.isDefault) ?? addresses.value[0]
      if (preferred) chooseAddress(preferred.id)
    }
  } catch (e) { if (current === addressGeneration) addressesError.value = e.data?.statusMessage ?? 'No pudimos cargar tus direcciones. Puedes reintentar o escribir una.' }
  finally { if (current === addressGeneration) addressesPending.value = false }
}
onMounted(() => {
  watch(() => session.value?.user?.id, (id, previous) => {
    addressGeneration++; addresses.value = []; addressesError.value = ''; addressesPending.value = false
    if (previous !== undefined && previous !== id) { chooseAddress(''); destinationEdited = false }
    addressChoice.value = ''
    if (id) loadAddresses()
  }, { immediate: true })
})
onBeforeUnmount(() => { addressGeneration++ })
let generation = 0
watch(destination, () => { destinationEdited = true; if (!applyingAddress) addressChoice.value = ''; generation++; choices.value = []; selected.value = null; error.value = ''; notice.value = 'La dirección cambió. Cotiza y acepta nuevamente el servicio.' }, { flush: 'sync' })
watch(() => props.version, () => { generation++; choices.value = []; selected.value = null; notice.value = 'El carrito cambió. Cotiza nuevamente.' })
async function quote() {
  if (pending.value || props.disabled) return
  try { postalCode(destination.postalCode) } catch (e) { error.value = e.message; return }
  pending.value = true; error.value = ''; notice.value = ''; selected.value = null; choices.value = []
  const currentGeneration = generation, version = props.version
  try {
    const response = await $fetch('/api/shipping/quotes', { method: 'POST', body: { destination: { ...destination } } })
    if (currentGeneration !== generation || version !== props.version || response.cartVersion !== version) return
    choices.value = response.quotes
    if (!choices.value.length) notice.value = 'No se devolvieron servicios disponibles para este destino y paquete. Revisa la dirección o intenta más tarde.'
  } catch (e) { if (currentGeneration === generation) error.value = e.data?.statusMessage ?? 'No pudimos cotizar. Intenta de nuevo.' }
  finally { pending.value = false }
}
async function accept(option) {
  if (pending.value || props.disabled) return
  pending.value = true; error.value = ''
  const currentGeneration = generation
  try {
    const response = await $fetch('/api/shipping/selected', { method: 'POST', body: { quoteId: option.id, destination: { ...destination } } })
    if (generation === currentGeneration && response.selected.cartVersion === props.version) { selected.value = response.selected; notice.value = 'Tarifa seleccionada. Se volverá a validar antes de pagar.' }
  } catch (e) { selected.value = null; error.value = e.data?.statusMessage ?? 'La cotización necesita actualizarse.' }
  finally { pending.value = false }
}
</script>
<template><section class="mt-6 rounded-sm border border-line bg-surface p-4" aria-label="Cotización de envío" :aria-busy="pending"><h2 class="text-display-m font-bold">Cotizar envío</h2><p class="mt-2 text-body-s text-ink-2">Un paquete por pedido. La estimación del proveedor no garantiza una fecha de entrega.</p><p v-if="addressesPending" role="status" class="mt-3 text-body-s">Cargando tus direcciones…</p><div v-if="addressesError" role="alert" class="mt-3 text-crit"><p>{{ addressesError }}</p><UiButton variant="secondary" class="mt-2" :disabled="addressesPending" @click="loadAddresses">Reintentar direcciones</UiButton></div><p v-if="session?.user && !addressesPending && !addressesError && !addresses.length" class="mt-3 text-body-s">No tienes direcciones guardadas. Puedes escribir una aquí o <NuxtLink to="/cuenta" class="underline">agregarla en tu cuenta</NuxtLink>.</p><form class="mt-4 grid gap-4 md:grid-cols-2" @submit.prevent="quote"><div v-if="session?.user && addresses.length" class="md:col-span-2"><UiField id="shipping-saved-address" :model-value="addressChoice" label="Usar una dirección de mi cuenta" :options="addressOptions" :disabled="pending || disabled || addressesPending" @update:model-value="chooseAddress" /></div><UiField id="shipping-name" v-model="destination.name" label="Nombre del destinatario" autocomplete="shipping name" required :disabled="pending || disabled" /><UiField id="shipping-phone" v-model="destination.phone" label="Teléfono" type="tel" autocomplete="shipping tel" required :disabled="pending || disabled" /><UiField id="shipping-postal" v-model="destination.postalCode" label="Código postal" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="shipping postal-code" required :disabled="pending || disabled" /><UiField id="shipping-state" v-model="destination.state" label="Estado" :options="stateOptions" autocomplete="shipping address-level1" required :disabled="pending || disabled" /><UiField id="shipping-city" v-model="destination.city" label="Ciudad" autocomplete="shipping address-level2" required :disabled="pending || disabled" /><UiField id="shipping-street" v-model="destination.street" label="Calle y número, incluyendo interior" autocomplete="shipping street-address" required :disabled="pending || disabled" /><div class="flex justify-start md:col-span-2"><UiButton type="submit" :disabled="pending || disabled">{{ pending ? 'Consultando…' : 'Cotizar servicios' }}</UiButton></div></form><p v-if="error" role="alert" class="mt-4 text-crit">{{ error }}</p><p v-if="notice" role="status" class="mt-4 text-body-s">{{ notice }}</p><ul v-if="choices.length" class="mt-4 space-y-3"><li v-for="option in choices" :key="option.id" class="rounded-sm border border-line p-3"><h3 class="font-semibold">{{ option.serviceName }} · {{ option.carrierCode }}</h3><p>{{ formatMXN(option.chargedAmountCents) }} MXN al cliente<span v-if="option.eligible"> · Tienda absorbe {{ formatMXN(option.quotedAmountCents) }}</span></p><p v-if="option.deliveryEstimate" class="mt-2 text-body-s">Estimación del proveedor: {{ option.deliveryEstimate }}</p><p v-else class="mt-2 text-body-s">El proveedor no informó una estimación.</p><UiButton class="mt-3" variant="secondary" :disabled="pending || disabled" :aria-pressed="selected?.id === option.id" @click="accept(option)">{{ selected?.id === option.id ? 'Servicio seleccionado' : 'Aceptar esta tarifa' }}</UiButton></li></ul><p v-if="selected" class="mt-4 text-body-s">Seleccionado: {{ selected.serviceName }} · Envío {{ formatMXN(selected.chargedAmountCents) }} MXN. Cotización sujeta a revalidación antes de pagar.</p></section></template>
