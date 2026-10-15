<script setup>
import { warehouseFields } from './warehouse-fields.js'
import { mexicanStates } from '~~/shared/features/shipping/mexican-states.js'
const props = defineProps({ warehouse: { type: Object, required: true } })
const emit = defineEmits(['saved', 'refresh'])
const editing = ref(false), busy = ref(false), failure = ref('')
const draft = reactive({}), reason = ref(''), expectedVersion = ref(null)
function edit() {
  for (const field of warehouseFields) draft[field.key] = props.warehouse[field.key] ?? ''
  expectedVersion.value = props.warehouse.configurationVersion
  reason.value = ''; failure.value = ''; editing.value = true
}
async function save() {
  if (busy.value) return
  busy.value = true; failure.value = ''
  try {
    await $fetch('/api/admin/warehouse', { method: 'PATCH', body: { ...draft, expectedConfigurationVersion: expectedVersion.value, reason: reason.value } })
    editing.value = false
    emit('saved')
  } catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos actualizar el almacén. Tus cambios siguen en el formulario.' }
  finally { busy.value = false }
}
const stateName = computed(() => mexicanStates.find(state => state.value === props.warehouse.state)?.label ?? props.warehouse.state)
const address = computed(() => `${props.warehouse.street} ${props.warehouse.exteriorNumber}${props.warehouse.interiorNumber ? `, interior ${props.warehouse.interiorNumber}` : ''}`)
</script>
<template>
  <section class="my-6 rounded-sm border border-border bg-surface p-4 md:p-6" aria-label="Información del almacén">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h3 class="text-display-s font-bold">Información del almacén</h3>
      <UiButton v-if="!editing" variant="secondary" @click="edit">Editar almacén</UiButton>
    </div>
    <dl class="mt-4 grid gap-4 break-words md:grid-cols-2">
      <div><dt class="text-body-s text-ink-2">Nombre del almacén</dt><dd class="font-semibold">{{ warehouse.name }}</dd></div>
      <div><dt class="text-body-s text-ink-2">Remitente</dt><dd>{{ warehouse.recipientName }}</dd></div>
      <div><dt class="text-body-s text-ink-2">Persona de contacto</dt><dd>{{ warehouse.contactName }}</dd></div>
      <div><dt class="text-body-s text-ink-2">Teléfono</dt><dd>{{ warehouse.phone }}</dd></div>
      <div class="md:col-span-2"><dt class="text-body-s text-ink-2">Dirección</dt><dd>{{ address }}<br>{{ warehouse.district }}, {{ warehouse.city }}<br>{{ stateName }}, C.P. {{ warehouse.postalCode }} · {{ warehouse.countryCode === 'MX' ? 'México' : warehouse.countryCode }}</dd></div>
      <div><dt class="text-body-s text-ink-2">Referencias</dt><dd>{{ warehouse.references || 'Sin referencias registradas' }}</dd></div>
      <div><dt class="text-body-s text-ink-2">Zona horaria</dt><dd>{{ warehouse.timezone }}</dd></div>
    </dl>
    <UiModal :open="editing" title="Editar información del almacén" :busy="busy" @close="editing = false">
    <form class="mt-6 border-t border-line pt-6" @submit.prevent="save">
      <h4 class="font-semibold">Editar información del almacén</h4>
      <p class="my-3 text-body-s text-ink-2">Los nuevos datos se usarán para cotizar envíos. Las cotizaciones pendientes deberán actualizarse; los pedidos existentes conservarán su dirección de origen registrada.</p>
      <p v-if="failure" role="alert" class="my-3 text-crit">{{ failure }}</p>
      <fieldset :disabled="busy" class="grid min-w-0 gap-4 md:grid-cols-2">
        <legend class="sr-only">Datos del almacén</legend>
        <UiField v-for="field in warehouseFields" :id="`edit-warehouse-${field.key}`" :key="field.key" v-model="draft[field.key]" :label="field.label" :type="field.type || 'text'" :options="field.options" :required="!field.optional" :maxlength="field.options ? undefined : field.maxlength || 120" :pattern="field.pattern" :inputmode="field.inputmode" />
        <UiField id="edit-warehouse-reason" v-model="reason" label="Motivo de los cambios" required maxlength="500" />
        <div class="flex flex-wrap items-center gap-3 md:col-span-2"><UiButton type="submit" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar cambios del almacén' }}</UiButton><UiButton variant="secondary" :disabled="busy" @click="editing = false">Cancelar</UiButton><UiButton v-if="failure" variant="secondary" :disabled="busy" @click="emit('refresh')">Actualizar información</UiButton></div>
      </fieldset>
    </form>
    </UiModal>
  </section>
</template>
