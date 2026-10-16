<script setup>
import { nutritionRows } from '~~/shared/features/catalog/product-selection.js'
const props = defineProps({ variant: { type: Object, required: true } })
const rows = computed(() => nutritionRows(props.variant.nutritionData))
</script>
<template>
  <section class="mt-16" aria-labelledby="product-nutrition-heading">
    <h2 id="product-nutrition-heading" class="mb-6 font-display text-display-l font-bold uppercase">Información nutrimental</h2>
    <div v-if="rows.length" class="overflow-x-auto rounded-sm border border-line bg-surface" tabindex="0" role="region" aria-label="Información nutrimental de la presentación seleccionada">
      <table class="w-full border-collapse text-left text-body-s"><caption class="border-b border-line p-4 text-left font-mono text-label uppercase tracking-widest text-ink-2">Información nutrimental<template v-if="variant.servings"> · {{ variant.servings }} porciones por envase</template></caption><thead><tr class="border-b border-line font-mono text-label uppercase tracking-wide text-ink-2"><th scope="col" class="p-3">Nutrimento</th><th scope="col" class="p-3 text-right">Cantidad declarada</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id" class="border-b border-line last:border-0"><th scope="row" class="p-3 font-normal">{{ row.nutrient }}</th><td class="p-3 text-right font-mono tabular-nums">{{ row.amount }}</td></tr></tbody></table>
    </div>
    <p v-else class="rounded-sm border border-line bg-surface p-4 text-body-s text-ink-2">No hay información nutrimental estructurada para esta presentación. Consulta la imagen nutrimental de la galería, si está disponible.</p>
  </section>
</template>
