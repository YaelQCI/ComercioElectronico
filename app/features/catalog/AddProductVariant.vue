<script setup>
import { pesosToCents } from '../administration/price-input.js'
import VariantNutritionFields from './VariantNutritionFields.vue'
const props = defineProps({ product: { type: Object, required: true }, fields: { type: Array, required: true } })
const emit = defineEmits(['created'])
const open = ref(false), busy = ref(false), failure = ref(''), draft = reactive({})
const message = useConfirmationMessage()
function begin() { Object.assign(draft, Object.fromEntries(props.fields.map(field => [field.key, ''])), { servings: '', servingAmount: '', servingUnit: '', nutritionRows: [], compareAtPricePesos: '', reason: '' }); failure.value = ''; open.value = true }
async function save() {
  if (busy.value) return
  busy.value = true; failure.value = ''
  try {
    const body = Object.fromEntries(props.fields.map(field => [field.price ? 'priceCents' : field.key, field.price ? pesosToCents(draft[field.key]) : field.numeric ? Number(draft[field.key]) : draft[field.key]]))
    Object.assign(body, { reason: draft.reason, servings: draft.servings || null, servingAmount: draft.servingAmount || null, servingUnit: draft.servingUnit || null, nutritionData: { rows: draft.nutritionRows.map(row => ({ ...row, amount: String(row.amount) })) }, compareAtPriceCents: draft.compareAtPricePesos ? pesosToCents(draft.compareAtPricePesos) : null, expectedUpdatedAt: props.product.updatedAt })
    await $fetch(`/api/admin/catalog/${props.product.id}/variants`, { method: 'POST', body })
    open.value = false; emit('created'); message.value = 'Presentación registrada. Ya puedes asignarle imágenes e inventario.'
  } catch (error) { failure.value = error.data?.statusMessage ?? error.message ?? 'No pudimos registrar la presentación.' } finally { busy.value = false }
}
</script>
<template>
  <section class="mt-8"><h3 class="text-display-s font-bold">Presentaciones adicionales</h3><p class="my-3 text-body-s text-ink-2">Guarda los cambios del formulario antes de agregar una presentación. Se crea sin inventario; registra sus lotes desde Inventario.</p><UiButton variant="secondary" :disabled="product.deactivated" aria-haspopup="dialog" @click="begin">Agregar presentación</UiButton></section>
  <UiModal :open="open" title="Agregar presentación" :busy="busy" @close="open = false"><p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p><form @submit.prevent="save"><fieldset :disabled="busy" class="grid gap-4 md:grid-cols-2"><legend class="sr-only">Datos de la nueva presentación</legend><UiField v-for="field in fields" :id="`new-variant-${field.key}`" :key="field.key" v-model="draft[field.key]" :label="field.label" :type="field.numeric ? 'number' : 'text'" :min="field.numeric ? 1 : undefined" :step="field.numeric ? 1 : undefined" :maxlength="field.numeric ? undefined : field.price ? 24 : 120" :inputmode="field.price ? 'decimal' : undefined" :pattern="field.price ? '[0-9]+([.,][0-9]{1,2})?' : undefined" required /><UiField id="new-variant-servings" v-model="draft.servings" label="Porciones por envase (opcional)" maxlength="15" /><UiField id="new-variant-previous-price" v-model="draft.compareAtPricePesos" label="Precio anterior en pesos (opcional)" maxlength="24" /><VariantNutritionFields :variant="draft" prefix="new-variant" :disabled="busy" /><UiField id="new-variant-reason" v-model="draft.reason" label="Motivo del alta" required maxlength="500" /><UiButton type="submit" :disabled="busy">Guardar presentación</UiButton></fieldset></form></UiModal>
</template>
