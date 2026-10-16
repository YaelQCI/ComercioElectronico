<script setup>
import { useAdministration } from './useAdministration.js'
import { warehouseFields } from './warehouse-fields.js'
import WarehouseInformation from './WarehouseInformation.vue'
import LotVariantPicker from './LotVariantPicker.vue'
import PackageAdministration from '../shipping/PackageAdministration.vue'
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/inventory', { query: { page } })
const { busy, failure, message, save } = useAdministration(refresh)
const lotOpen = ref(false), warehouseOpen = ref(false)
const lot = reactive({ sku: '', warehouseId: '', lotCode: '', expiresOn: '', initialQuantity: '', reason: '' })
const selected = ref(null), adjustment = reactive({ delta: '', reason: '' }), adjustmentKey = ref('')
watch(adjustment, () => { adjustmentKey.value = '' })
function select(item) { selected.value = item; adjustment.delta = ''; adjustment.reason = ''; adjustmentKey.value = '' }
async function adjust() {
  adjustmentKey.value ||= crypto.randomUUID()
  if (await save('/api/admin/inventory', { lotId: selected.value.id, delta: Number(adjustment.delta), reason: adjustment.reason, idempotencyKey: adjustmentKey.value })) selected.value = null
}
async function createLot() {
  if (busy.value || !lot.sku || lot.initialQuantity === '') return
  if (await save('/api/admin/lots', { ...lot, initialQuantity: Number(lot.initialQuantity) })) { Object.assign(lot, { sku: '', warehouseId: '', lotCode: '', expiresOn: '', initialQuantity: '', reason: '' }); lotOpen.value = false }
}
const warehouse = reactive(Object.fromEntries([...warehouseFields.map(field => [field.key, '']), ['reason', '']]))
async function createWarehouse() {
  if (await save('/api/admin/warehouse', { ...warehouse })) warehouseOpen.value = false
}
async function warehouseSaved() {
  failure.value = ''; message.value = 'Información del almacén actualizada.'
  await refresh()
}
</script>
<template>
  <div>
    <h2 class="text-display-m font-bold">Inventario</h2>
    <p v-if="failure" role="alert" class="my-4 text-crit">{{ failure }}</p>
    <UiLoading v-if="status === 'pending'" label="Cargando inventario" />
    <div v-else-if="error" role="alert"><p>No se pudo cargar el inventario.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else>
      <details class="my-4 rounded-sm border border-border bg-surface">
        <summary class="min-h-11 cursor-pointer rounded-sm p-4 text-display-s font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">Información del almacén</summary>
        <div class="px-4">
          <WarehouseInformation v-for="item in data?.warehouses" :key="item.id" :warehouse="item" @saved="warehouseSaved" @refresh="refresh" />
          <UiButton v-if="!data?.warehouses.length" class="my-4" aria-haspopup="dialog" @click="warehouseOpen = true">Configurar almacén inicial</UiButton>
        </div>
      </details>
      <details class="my-4 rounded-sm border border-border bg-surface">
        <summary class="min-h-11 cursor-pointer rounded-sm p-4 text-display-s font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">Cajas de envío</summary>
        <div class="px-4"><PackageAdministration /></div>
      </details>
      <UiModal :open="warehouseOpen" title="Configurar almacén inicial" :busy="busy" @close="warehouseOpen = false">
        <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
        <p class="my-3">Registra los datos reales del almacén antes de crear lotes. No se generan datos comerciales de ejemplo.</p>
        <form @submit.prevent="createWarehouse">
          <fieldset :disabled="busy" class="grid min-w-0 gap-4 md:grid-cols-2">
            <legend class="sr-only">Configuración inicial del almacén</legend>
            <UiField v-for="field in warehouseFields" :id="`warehouse-${field.key}`" :key="field.key" v-model="warehouse[field.key]" :label="field.label" :type="field.type || 'text'" :options="field.options" :required="!field.optional" :maxlength="field.options ? undefined : field.maxlength || 120" :pattern="field.pattern" :inputmode="field.inputmode" />
            <UiField id="warehouse-reason" v-model="warehouse.reason" label="Motivo del alta" required maxlength="500" />
            <UiButton type="submit" :disabled="busy">Configurar almacén</UiButton>
          </fieldset>
        </form>
      </UiModal>
      <h3 class="mt-6 text-display-s font-bold">Lotes</h3>
      <UiButton class="my-4" aria-haspopup="dialog" @click="lotOpen = true">Registrar lote</UiButton>
      <UiModal :open="lotOpen" title="Registrar lote" :busy="busy" @close="lotOpen = false"><p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p><p class="my-3 text-ink-2">Registra el lote y sus existencias iniciales. Para entradas o salidas posteriores utiliza Ajustar lote.</p><form class="grid gap-4 md:grid-cols-2" @submit.prevent="createLot">
        <LotVariantPicker v-model="lot.sku" :disabled="busy" />
        <UiField id="lot-warehouse" v-model="lot.warehouseId" label="Almacén" :options="[{ value: '', label: 'Selecciona un almacén' }, ...(data?.warehouses || []).map(w => ({ value: w.id, label: w.name }))]" required />
        <UiField id="lot-code" v-model="lot.lotCode" label="Código de lote" required maxlength="120" />
        <UiField id="lot-quantity" v-model="lot.initialQuantity" label="Cantidad inicial (piezas)" type="number" min="0" max="2147483647" step="1" inputmode="numeric" hint="Número de piezas recibidas. Usa 0 si solo deseas registrar el lote sin existencias." required :disabled="busy" />
        <UiField id="lot-expiry" v-model="lot.expiresOn" label="Caducidad (opcional)" type="date" />
        <UiField id="lot-reason" v-model="lot.reason" label="Motivo del alta" required maxlength="500" />
        <UiButton type="submit" :disabled="busy || !lot.sku || !data?.warehouses.length">Registrar lote</UiButton>
      </form></UiModal>
      <p v-if="!data?.lots.length" class="my-6">No hay lotes registrados.</p>
      <ul class="grid gap-4"><li v-for="item in data?.lots" :key="item.id" class="relative isolate rounded-sm border border-border bg-surface p-4 hover:border-ink"><h3 class="font-semibold"><NuxtLink :to="{ path: `/producto/${item.productId}`, query: { variante: item.variantId } }" class="after:absolute after:inset-0 after:rounded-sm focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink">{{ item.productName }} · {{ item.sku }} · {{ item.lotCode }}</NuxtLink></h3><p>{{ item.warehouse }} · Caducidad: {{ item.expiresOn || 'Sin registrar' }}{{ item.isBlocked ? ' · Bloqueado' : '' }}</p><dl class="my-3 flex flex-wrap gap-6"><div><dt class="text-body-s text-ink-2">Existencias</dt><dd>{{ item.onHandQty }}</dd></div><div><dt class="text-body-s text-ink-2">Reservadas</dt><dd>{{ item.reservedQty }}</dd></div><div><dt class="text-body-s text-ink-2">No vendibles</dt><dd>{{ item.nonSellableQty }}</dd></div></dl><UiButton variant="secondary" class="relative z-10" :disabled="busy" @click="select(item)">Ajustar lote {{ item.lotCode }}</UiButton></li></ul>
      <nav aria-label="Páginas de inventario" class="my-4 flex items-center gap-4"><UiButton variant="secondary" :disabled="page <= 1 || busy" @click="page--">Anterior</UiButton><span>Página {{ page }} de {{ data?.pages || 1 }}</span><UiButton variant="secondary" :disabled="page >= (data?.pages || 1) || busy" @click="page++">Siguiente</UiButton></nav>
      <UiModal :open="!!selected" title="Ajustar inventario" :busy="busy" @close="selected = null"><p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
      <form class="mt-6 grid gap-4 rounded-sm border border-border p-4" @submit.prevent="adjust"><h3 class="font-semibold">Ajuste: {{ selected.sku }} · {{ selected.lotCode }}</h3><UiField id="stock-delta" v-model="adjustment.delta" label="Cantidad de piezas a agregar o retirar" type="number" step="1" min="-2147483647" max="2147483647" hint="Positivo para entradas y negativo para salidas. No se pueden retirar piezas reservadas." required /><UiField id="stock-reason" v-model="adjustment.reason" label="Motivo del ajuste" required maxlength="500" /><div class="flex gap-3"><UiButton type="submit" :disabled="busy || !Number(adjustment.delta)">Guardar ajuste</UiButton><UiButton variant="secondary" :disabled="busy" @click="selected = null">Cancelar</UiButton></div></form></UiModal>
    </template>
  </div>
</template>
