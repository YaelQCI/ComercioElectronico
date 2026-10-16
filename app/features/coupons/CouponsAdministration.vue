<script setup>
import { useAdministration } from '../administration/useAdministration.js'
import { pesosToCents, centsToPesos } from '../administration/price-input.js'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/coupons', { query: { page } })
const { busy, failure, message, save } = useAdministration(refresh)
const open = ref(false), editing = ref(null), form = reactive({}), selected = ref([]), options = ref({ products: [], categories: [] }), search = ref(''), optionsError = ref(''), optionsBusy = ref(false), localError = ref('')
function localDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function start(coupon = null) {
  editing.value = coupon
  Object.assign(form, { code: coupon?.code ?? '', kind: coupon?.kind ?? 'PERCENTAGE', amount: coupon ? coupon.kind === 'FIXED' ? centsToPesos(coupon.fixedAmountCents) : centsToPesos(String(coupon.percentageBasisPoints)) : '10', minimum: centsToPesos(coupon?.minimumEligibleCents), startsAt: localDate(coupon?.startsAt), endsAt: localDate(coupon?.endsAt), maxUses: coupon?.maxUses ?? '', maxUsesPerCustomer: coupon?.maxUsesPerCustomer ?? '', scope: coupon?.scope ?? 'CATALOG', isActive: coupon?.isActive ?? true, allowOffers: coupon?.allowOffers ?? false, allowBundles: coupon?.allowBundles ?? false, reason: '' })
  selected.value = coupon ? [...(coupon.scope === 'PRODUCTS' ? coupon.products : coupon.categories)] : []
  search.value = ''; failure.value = ''; localError.value = ''; open.value = true
  loadOptions()
}
async function loadOptions() {
  if (optionsBusy.value) return
  optionsBusy.value = true; optionsError.value = ''
  try { options.value = await $fetch('/api/admin/coupons/options', { query: { q: search.value } }) }
  catch { optionsError.value = 'No pudimos cargar las opciones. Vuelve a buscar.' }
  finally { optionsBusy.value = false }
}
function toggle(item, checked) {
  selected.value = checked ? [...selected.value, item] : selected.value.filter(row => row.id !== item.id)
}
async function submit() {
  localError.value = ''
  try {
    const amount = pesosToCents(form.amount)
    const result = await save(editing.value ? `/api/admin/coupons/${editing.value.id}` : '/api/admin/coupons', {
      code: form.code, kind: form.kind, fixedAmountCents: form.kind === 'FIXED' ? amount : null, percentageBasisPoints: form.kind === 'PERCENTAGE' ? Number(amount) : null,
      minimumEligibleCents: form.minimum.trim() ? pesosToCents(form.minimum) : null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      maxUses: form.maxUses === '' ? null : Number(form.maxUses), maxUsesPerCustomer: form.maxUsesPerCustomer === '' ? null : Number(form.maxUsesPerCustomer),
      scope: form.scope, productIds: form.scope === 'PRODUCTS' ? selected.value.map(p => p.id) : [], categoryIds: form.scope === 'CATEGORIES' ? selected.value.map(c => c.id) : [],
      isActive: form.isActive, allowOffers: form.allowOffers, allowBundles: form.allowBundles, reason: form.reason, expectedVersion: editing.value?.version,
    }, editing.value ? 'PATCH' : 'POST')
    if (result) open.value = false
  } catch { localError.value = 'Revisa los importes y las fechas. Usa hasta dos decimales en el descuento y la compra mínima.' }
}
function state(coupon) {
  if (!coupon.isActive) return 'Desactivado'
  if (coupon.endsAt && Date.parse(coupon.endsAt) <= Date.now()) return 'Vencido'
  if (coupon.startsAt && Date.parse(coupon.startsAt) > Date.now()) return 'Programado'
  if (coupon.maxUses && coupon.uses.RESERVED + coupon.uses.CONSUMED >= coupon.maxUses) return 'Límite alcanzado'
  return 'Activo'
}
const dateLabel = value => value ? new Date(value).toLocaleString('es-MX') : 'Sin límite'
</script>
<template>
  <section aria-labelledby="coupons-title">
    <div class="flex flex-wrap items-center justify-between gap-4"><h2 id="coupons-title" class="text-display-m font-bold">Cupones de descuento</h2><UiButton @click="start()">Crear cupón</UiButton></div>
    <p class="mt-3 text-ink-2">Un cupón por carrito. El descuento aplica a productos elegibles; el envío no se descuenta. Los usos reservados también ocupan el límite.</p>
    <p v-if="message" role="status" class="mt-4">{{ message }}</p>
    <UiLoading v-if="status === 'pending'" label="Cargando cupones" />
    <div v-else-if="error" role="alert" class="mt-4"><p>No pudimos cargar los cupones.</p><UiButton @click="refresh()">Reintentar</UiButton></div>
    <template v-else>
      <p v-if="!data?.coupons.length" class="mt-6 border border-border bg-surface p-6">Todavía no hay cupones. Crea el primero para compartirlo con tus clientes.</p>
      <ul v-else class="mt-6 grid gap-4">
        <li v-for="coupon in data.coupons" :key="coupon.id" class="border border-border bg-surface p-5">
          <div class="flex flex-wrap items-center justify-between gap-3"><h3 class="break-all text-body-l font-bold">{{ coupon.code }}</h3><strong class="border border-border px-3 py-1">{{ state(coupon) }}</strong></div>
          <p class="mt-3 font-semibold">{{ coupon.kind === 'FIXED' ? `${formatMXN(coupon.fixedAmountCents)} MXN de descuento` : `${coupon.percentageBasisPoints / 100} % de descuento` }}</p>
          <p class="text-ink-2">{{ coupon.scope === 'CATALOG' ? 'Todo el catálogo' : coupon.scope === 'PRODUCTS' ? `${coupon.products.length} productos seleccionados` : `${coupon.categories.length} categorías seleccionadas` }} · Mínimo: {{ coupon.minimumEligibleCents ? formatMXN(coupon.minimumEligibleCents) : 'Sin mínimo' }}</p>
          <p class="mt-2 text-body-s">Inicio: {{ dateLabel(coupon.startsAt) }} · Fin: {{ dateLabel(coupon.endsAt) }}</p>
          <p class="mt-2 text-body-s">Consumidos: {{ coupon.uses.CONSUMED }} · Reservados: {{ coupon.uses.RESERVED }} · Liberados: {{ coupon.uses.RELEASED }}</p>
          <p class="text-body-s">Límite global: {{ coupon.maxUses ?? 'Sin límite' }} · Por cliente: {{ coupon.maxUsesPerCustomer ?? 'Sin límite' }}</p>
          <UiButton variant="secondary" class="mt-4" :aria-label="`Editar cupón ${coupon.code}`" @click="start(coupon)">Editar / activar o desactivar</UiButton>
        </li>
      </ul>
      <nav v-if="data?.pages > 1" aria-label="Páginas de cupones" class="mt-6 flex items-center justify-center gap-3"><UiButton variant="secondary" :disabled="page <= 1" @click="page--">Anterior</UiButton><span>{{ data.page }} de {{ data.pages }}</span><UiButton variant="secondary" :disabled="page >= data.pages" @click="page++">Siguiente</UiButton></nav>
    </template>
    <UiModal :open="open" :title="editing ? `Editar cupón ${editing.code}` : 'Crear cupón'" :busy="busy" @close="open = false">
      <form class="grid gap-5" @submit.prevent="submit">
        <p class="text-ink-2">Los cambios se registran en el historial. Editar un cupón requiere que los carritos vuelvan a aceptar sus condiciones; no modifica pedidos ya pagados.</p>
        <fieldset :disabled="busy" class="grid min-w-0 gap-5 sm:grid-cols-2">
          <UiField id="coupon-code" v-model="form.code" label="Código del cupón" maxlength="60" pattern="[A-Za-z0-9_-]{1,60}" required :disabled="!!editing" hint="Sin espacios. No distingue mayúsculas. El código no se puede cambiar después." />
          <UiField id="coupon-kind" v-model="form.kind" label="Tipo de descuento" :options="[{ value: 'PERCENTAGE', label: 'Porcentaje' }, { value: 'FIXED', label: 'Importe fijo (MXN)' }]" />
          <UiField id="coupon-amount" v-model="form.amount" :label="form.kind === 'PERCENTAGE' ? 'Porcentaje (0.01 a 100)' : 'Descuento en MXN'" inputmode="decimal" required />
          <UiField id="coupon-minimum" v-model="form.minimum" label="Compra mínima elegible en MXN (opcional)" inputmode="decimal" hint="Solo se suman los productos a los que aplica el cupón." />
          <UiField id="coupon-start" v-model="form.startsAt" label="Inicio (opcional)" type="datetime-local" hint="Horario local de tu dispositivo." />
          <UiField id="coupon-end" v-model="form.endsAt" label="Fin (opcional)" type="datetime-local" hint="Deja de aplicar al llegar a esta fecha y hora." />
          <UiField id="coupon-limit" v-model="form.maxUses" label="Límite global de usos (opcional)" type="number" min="1" max="2147483647" step="1" />
          <UiField id="coupon-customer-limit" v-model="form.maxUsesPerCustomer" label="Usos por cliente (opcional)" type="number" min="1" max="2147483647" step="1" />
          <UiField id="coupon-scope" v-model="form.scope" label="Aplicar a" :options="[{ value: 'CATALOG', label: 'Todo el catálogo' }, { value: 'PRODUCTS', label: 'Productos seleccionados' }, { value: 'CATEGORIES', label: 'Categorías seleccionadas' }]" @change="selected = []" />
          <div class="flex flex-col justify-center gap-3"><label><input v-model="form.isActive" type="checkbox"> Cupón activo</label><label><input v-model="form.allowOffers" type="checkbox"> Permitir productos en oferta</label><label><input v-model="form.allowBundles" type="checkbox"> Permitir paquetes</label></div>
          <div v-if="form.scope !== 'CATALOG'" class="sm:col-span-2">
            <div v-if="form.scope === 'PRODUCTS'" class="flex flex-wrap items-end gap-3"><UiField id="coupon-search" v-model="search" label="Buscar productos por nombre" class="grow" /><UiButton variant="secondary" :disabled="optionsBusy" @click="loadOptions">Buscar</UiButton></div>
            <p v-if="optionsError" role="alert" class="mt-3 text-crit">{{ optionsError }}</p>
            <UiLoading v-if="optionsBusy" label="Cargando opciones" />
            <div v-else class="mt-3 grid max-h-64 gap-3 overflow-y-auto border border-border p-3">
              <label v-for="item in form.scope === 'PRODUCTS' ? options.products : options.categories" :key="item.id" class="flex items-center gap-3"><input type="checkbox" :checked="selected.some(row => row.id === item.id)" @change="toggle(item, $event.target.checked)">{{ item.name }}</label>
              <p v-if="!(form.scope === 'PRODUCTS' ? options.products : options.categories).length">No hay coincidencias.</p>
            </div>
            <p class="mt-2 text-body-s text-ink-2">Hasta 100 seleccionados. La búsqueda muestra hasta 30 productos; escribe su nombre para encontrar otros.</p>
            <ul class="mt-3 flex flex-wrap gap-2"><li v-for="item in selected" :key="item.id"><button type="button" class="border border-border px-3 py-2 text-body-s" :aria-label="`Quitar ${item.name}`" @click="toggle(item, false)">{{ item.name }} ×</button></li></ul>
          </div>
          <UiField id="coupon-reason" v-model="form.reason" label="Motivo del cambio" required maxlength="500" class="sm:col-span-2" />
        </fieldset>
        <p v-if="failure || localError" role="alert" class="text-crit">{{ failure || localError }}</p>
        <div class="flex flex-wrap justify-end gap-3"><UiButton variant="secondary" :disabled="busy" @click="open = false">Cancelar</UiButton><UiButton type="submit" :disabled="busy">{{ busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cupón' }}</UiButton></div>
      </form>
    </UiModal>
  </section>
</template>
