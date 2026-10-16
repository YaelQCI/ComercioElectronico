<script setup>
import { packageMeasurements } from '~~/shared/features/shipping/package-configuration.js'
import { useAdministration } from '../administration/useAdministration.js'
const { data, status, error, refresh } = await useFetch('/api/admin/packages')
const { busy, failure, save } = useAdministration(refresh)
const open = ref(false), target = ref(null), draft = reactive({})
function edit(box) {
  target.value = box ?? null
  Object.assign(draft, { code: box?.code ?? '', isActive: box ? String(box.isActive) : 'true', reason: '', ...Object.fromEntries(packageMeasurements.map(field => [field.key, box?.[field.key] == null ? '' : String(box[field.key])])) })
  failure.value = ''; open.value = true
}
async function submit() {
  const body = { code: draft.code, isActive: draft.isActive === 'true', reason: draft.reason, ...Object.fromEntries(packageMeasurements.map(field => [field.key, field.optional && draft[field.key] === '' ? null : Number(draft[field.key])])) }
  if (target.value) body.expectedVersion = target.value.version
  if (await save(target.value ? `/api/admin/packages/${target.value.id}` : '/api/admin/packages', body, target.value ? 'PATCH' : 'POST')) open.value = false
}
</script>
<template>
  <section class="my-6 rounded-sm border border-border bg-surface p-4 md:p-6" aria-label="Cajas de envío">
    <div class="flex flex-wrap items-center justify-between gap-4"><h3 class="text-display-s font-bold">Cajas de envío</h3><UiButton aria-haspopup="dialog" @click="edit()">Agregar caja</UiButton></div>
    <p class="mt-3 text-body-s text-ink-2">Registra las medidas reales de tus cajas. Se selecciona una caja activa que pueda contener todo el pedido, incluyendo su peso. CAJA-CHICA, CAJA-MEDIANA y CAJA-GRANDE tienen valores iniciales de referencia: verifica sus medidas y resistencia con tus cajas físicas.</p>
    <UiLoading v-if="status === 'pending'" label="Cargando cajas" />
    <div v-else-if="error" role="alert" class="mt-4"><p>No pudimos cargar las cajas.</p><UiButton variant="secondary" @click="refresh">Reintentar</UiButton></div>
    <template v-else>
      <p v-if="!data?.packages.length" class="mt-4">No hay cajas registradas. Agrega una para poder cotizar envíos.</p>
      <ul class="mt-4 grid gap-4"><li v-for="box in data?.packages" :key="box.id" class="rounded-sm border border-line p-4">
        <h4 class="font-semibold">{{ box.code }} · {{ box.isActive ? 'Activa' : 'Inactiva' }}</h4>
        <dl class="my-3 grid gap-3 md:grid-cols-2"><div><dt>Medidas interiores (largo × ancho × alto)</dt><dd>{{ box.innerLengthMm }} × {{ box.innerWidthMm }} × {{ box.innerHeightMm }} mm</dd></div><div><dt>Medidas exteriores (largo × ancho × alto)</dt><dd>{{ box.outerLengthMm }} × {{ box.outerWidthMm }} × {{ box.outerHeightMm }} mm</dd></div><div><dt>Peso de la caja vacía</dt><dd>{{ box.tareWeightGrams }} g</dd></div><div><dt>Peso bruto máximo</dt><dd>{{ box.maxGrossWeightGrams == null ? 'Sin límite configurado' : `${box.maxGrossWeightGrams} g` }}</dd></div></dl>
        <UiButton variant="secondary" aria-haspopup="dialog" @click="edit(box)">Editar caja {{ box.code }}</UiButton>
      </li></ul>
    </template>
    <UiModal :open="open" :title="target ? 'Editar caja de envío' : 'Agregar caja de envío'" :busy="busy" @close="open = false">
      <p class="mb-4 text-body-s">Medidas en milímetros y pesos en gramos. El peso bruto incluye productos y caja. Al cambiar la configuración será necesario recotizar; los pedidos existentes conservan sus datos.</p>
      <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
      <form @submit.prevent="submit"><fieldset :disabled="busy" class="grid gap-4 md:grid-cols-2"><legend class="sr-only">Configuración de caja</legend>
        <UiField id="package-code" v-model="draft.code" label="Código de caja" required maxlength="60" />
        <UiField id="package-active" v-model="draft.isActive" label="Disponibilidad" :options="[{ value: 'true', label: 'Activa para cotizar' }, { value: 'false', label: 'Inactiva' }]" required />
        <UiField v-for="field in packageMeasurements" :id="`package-${field.key}`" :key="field.key" v-model="draft[field.key]" :label="field.label" type="number" step="1" :min="field.min ?? 1" max="2147483647" :required="!field.optional" />
        <UiField id="package-reason" v-model="draft.reason" label="Motivo del cambio" required maxlength="500" />
        <div class="flex flex-wrap items-center gap-3 md:col-span-2"><UiButton type="submit" :disabled="busy">Guardar caja</UiButton><UiButton variant="secondary" :disabled="busy" @click="open = false">Cancelar</UiButton><UiButton v-if="failure" variant="secondary" :disabled="busy" @click="refresh">Actualizar lista</UiButton></div>
      </fieldset></form>
    </UiModal>
  </section>
</template>
