<script setup>
import { useAdministration } from './useAdministration.js'
import { warehouseFields } from './warehouse-fields.js'
import WarehouseInformation from './WarehouseInformation.vue'
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/inventory', { query: { page } })
const { busy, failure, message, save } = useAdministration(refresh)
const lot = reactive({ sku: '', warehouseId: '', lotCode: '', expiresOn: '', reason: '' })
const selected = ref(null), adjustment = reactive({ delta: '', reason: '' }), adjustmentKey = ref('')
watch(adjustment, () => { adjustmentKey.value = '' })
function select(item) { selected.value = item; adjustment.delta = ''; adjustment.reason = ''; adjustmentKey.value = '' }
async function adjust() {
  adjustmentKey.value ||= crypto.randomUUID()
  if (await save('/api/admin/inventory', { lotId: selected.value.id, delta: Number(adjustment.delta), reason: adjustment.reason, idempotencyKey: adjustmentKey.value })) selected.value = null
}
async function createLot() {
  if (await save('/api/admin/lots', { ...lot })) Object.assign(lot, { sku: '', warehouseId: '', lotCode: '', expiresOn: '', reason: '' })
}
const warehouse = reactive(Object.fromEntries([...warehouseFields.map(field => [field.key, '']), ['reason', '']]))
async function warehouseSaved() {
  failure.value = ''; message.value = 'Información del almacén actualizada.'
  await refresh()
}
</script>
<template>
  <div>
    <h2 class="text-display-m font-bold">Inventario</h2>
    <p v-if="failure" role="alert" class="my-4 text-crit">{{ failure }}</p><p v-if="message" role="status" class="my-4 text-ok">{{ message }}</p>
    <UiLoading v-if="status === 'pending'" label="Cargando inventario" />
    <div v-else-if="error" role="alert"><p>No se pudo cargar el inventario.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else>
      <WarehouseInformation v-for="item in data?.warehouses" :key="item.id" :warehouse="item" @saved="warehouseSaved" @refresh="refresh" />
      <details v-if="!data?.warehouses.length" class="my-6 rounded-sm border border-border p-4">
        <summary class="min-h-11 cursor-pointer font-semibold">Configurar almacén inicial</summary>
        <p class="my-3">Registra los datos reales del almacén antes de crear lotes. No se generan datos comerciales de ejemplo.</p>
        <form @submit.prevent="save('/api/admin/warehouse', { ...warehouse })">
          <fieldset :disabled="busy" class="grid min-w-0 gap-4 md:grid-cols-2">
            <legend class="sr-only">Configuración inicial del almacén</legend>
            <UiField v-for="field in warehouseFields" :id="`warehouse-${field.key}`" :key="field.key" v-model="warehouse[field.key]" :label="field.label" :type="field.type || 'text'" :options="field.options" :required="!field.optional" :maxlength="field.options ? undefined : field.maxlength || 120" :pattern="field.pattern" :inputmode="field.inputmode" />
            <UiField id="warehouse-reason" v-model="warehouse.reason" label="Motivo del alta" required maxlength="500" />
            <UiButton type="submit" :disabled="busy">Configurar almacén</UiButton>
          </fieldset>
        </form>
      </details>
      <details class="my-6 rounded-sm border border-border p-4"><summary class="min-h-11 cursor-pointer font-semibold">Registrar lote</summary><p class="my-3 text-ink-2">El lote comienza con cero piezas. Registra después una entrada con su motivo.</p><form class="grid gap-4 md:grid-cols-2" @submit.prevent="createLot">
        <UiField id="lot-sku" v-model="lot.sku" label="SKU de la variante" required />
        <UiField id="lot-warehouse" v-model="lot.warehouseId" label="Almacén" :options="[{ value: '', label: 'Selecciona un almacén' }, ...(data?.warehouses || []).map(w => ({ value: w.id, label: w.name }))]" required />
        <UiField id="lot-code" v-model="lot.lotCode" label="Código de lote" required maxlength="120" />
        <UiField id="lot-expiry" v-model="lot.expiresOn" label="Caducidad (opcional)" type="date" />
        <UiField id="lot-reason" v-model="lot.reason" label="Motivo del alta" required maxlength="500" />
        <UiButton type="submit" :disabled="busy || !data?.warehouses.length">Registrar lote</UiButton>
      </form></details>
      <p v-if="!data?.lots.length" class="my-6">No hay lotes registrados.</p>
      <ul class="grid gap-4"><li v-for="item in data?.lots" :key="item.id" class="rounded-sm border border-border bg-surface p-4"><h3 class="font-semibold">{{ item.sku }} · {{ item.lotCode }}</h3><p>{{ item.warehouse }} · Caducidad: {{ item.expiresOn || 'Sin registrar' }}{{ item.isBlocked ? ' · Bloqueado' : '' }}</p><dl class="my-3 flex flex-wrap gap-6"><div><dt class="text-body-s text-ink-2">Existencias</dt><dd>{{ item.onHandQty }}</dd></div><div><dt class="text-body-s text-ink-2">Reservadas</dt><dd>{{ item.reservedQty }}</dd></div><div><dt class="text-body-s text-ink-2">No vendibles</dt><dd>{{ item.nonSellableQty }}</dd></div></dl><UiButton variant="secondary" :disabled="busy" @click="select(item)">Ajustar lote {{ item.lotCode }}</UiButton></li></ul>
      <nav aria-label="Páginas de inventario" class="my-4 flex items-center gap-4"><UiButton variant="secondary" :disabled="page <= 1 || busy" @click="page--">Anterior</UiButton><span>Página {{ page }} de {{ data?.pages || 1 }}</span><UiButton variant="secondary" :disabled="page >= (data?.pages || 1) || busy" @click="page++">Siguiente</UiButton></nav>
      <form v-if="selected" class="mt-6 grid gap-4 rounded-sm border border-border p-4" @submit.prevent="adjust"><h3 class="font-semibold">Ajuste: {{ selected.sku }} · {{ selected.lotCode }}</h3><UiField id="stock-delta" v-model="adjustment.delta" label="Cantidad de piezas a agregar o retirar" type="number" step="1" min="-2147483647" max="2147483647" hint="Positivo para entradas y negativo para salidas. No se pueden retirar piezas reservadas." required /><UiField id="stock-reason" v-model="adjustment.reason" label="Motivo del ajuste" required maxlength="500" /><div class="flex gap-3"><UiButton type="submit" :disabled="busy || !Number(adjustment.delta)">Guardar ajuste</UiButton><UiButton variant="secondary" :disabled="busy" @click="selected = null">Cancelar</UiButton></div></form>
    </template>
  </div>
</template>
