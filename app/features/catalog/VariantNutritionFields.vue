<script setup>
defineProps({ variant: { type: Object, required: true }, prefix: { type: String, required: true }, disabled: Boolean })
</script>
<template>
  <fieldset :disabled="disabled" class="grid min-w-0 gap-4 rounded-sm border border-line p-4 md:col-span-2 md:grid-cols-2">
    <legend class="px-2 font-semibold">Porción e información nutrimental</legend>
    <UiField :id="`${prefix}-serving-amount`" v-model="variant.servingAmount" label="Tamaño de porción (opcional)" inputmode="decimal" pattern="(0|[1-9][0-9]{0,9})([.][0-9]{1,4})?" maxlength="15" hint="Cantidad indicada en la etiqueta. Completa también su unidad." />
    <UiField :id="`${prefix}-serving-unit`" v-model="variant.servingUnit" label="Unidad de porción (opcional)" maxlength="30" hint="Por ejemplo: g, ml o cápsula. Deja ambos campos vacíos si no aplica." />
    <div class="min-w-0 md:col-span-2">
      <p class="mb-3 text-body-s text-ink-2">Transcribe los valores de la etiqueta; no se calculan nutrientes automáticamente. Hasta 100 filas. Una tabla vacía elimina los datos estructurados anteriores.</p>
      <div v-for="(row, index) in variant.nutritionRows" :key="index" class="mb-4 grid min-w-0 gap-3 border-b border-line pb-4 sm:grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <UiField :id="`${prefix}-nutrient-${index}`" v-model="row.name" label="Nutrimento" maxlength="120" required />
        <UiField :id="`${prefix}-amount-${index}`" v-model="row.amount" label="Cantidad declarada" type="number" min="0" step="0.0001" required />
        <UiField :id="`${prefix}-unit-${index}`" v-model="row.unit" label="Unidad" maxlength="30" required />
        <UiButton variant="secondary" class="self-end" :aria-label="`Quitar nutrimento ${index + 1}`" @click="variant.nutritionRows.splice(index, 1)">Quitar</UiButton>
      </div>
      <UiButton variant="secondary" :disabled="disabled || variant.nutritionRows.length >= 100" @click="variant.nutritionRows.push({ name: '', amount: '', unit: '' })">Agregar nutrimento</UiButton>
    </div>
  </fieldset>
</template>
