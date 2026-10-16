<script setup>
import { comparePresentations, formatMXN } from '~~/shared/features/pricing/prices.js'
const props = defineProps({ variants: { type: Array, required: true } })
const rows = computed(() => comparePresentations(props.variants))
const multipleFlavors = computed(() => new Set(props.variants.map(variant => variant.flavor)).size > 1)
</script>
<template>
  <section v-if="rows.length" class="mt-16" aria-labelledby="portion-comparison-heading">
    <h2 id="portion-comparison-heading" class="mb-6 font-display text-display-l font-bold uppercase">Cuánto te cuesta cada porción</h2>
    <div class="overflow-x-auto rounded-sm border border-line bg-surface" tabindex="0" role="region" aria-label="Comparación de presentaciones">
      <table class="w-full border-collapse text-left text-body-s">
        <caption class="border-b border-line p-4 text-left font-mono text-label uppercase tracking-widest text-ink-2">Costo por porción según la presentación · MXN</caption>
        <thead><tr class="border-b border-line font-mono text-label uppercase tracking-wide text-ink-2"><th scope="col" class="p-3">Presentación</th><th scope="col" class="p-3 text-right">Precio</th><th scope="col" class="p-3 text-right">Porciones</th><th scope="col" class="p-3 text-right">Costo por porción</th></tr></thead>
        <tbody><tr v-for="row in rows" :key="row.id" class="border-b border-line last:border-0" :class="row.isBest && rows.length > 1 ? 'bg-accent-soft' : ''"><th scope="row" class="p-3 font-normal">{{ row.presentationLabel }}<span v-if="multipleFlavors" class="mt-1 block text-label text-ink-2">{{ row.flavor }}</span><span v-if="row.isBest && rows.length > 1" class="ml-2 inline-block rounded-sm bg-accent px-2 py-1 font-mono text-label font-semibold uppercase text-accent-ink">Mejor valor</span></th><td class="p-3 text-right font-mono tabular-nums">{{ row.priceLabel }}</td><td class="p-3 text-right font-mono tabular-nums">{{ row.servings ?? 'Sin documentar' }}</td><td class="p-3 text-right font-mono tabular-nums">{{ row.servingCostLabel ?? 'No comparable' }}<span v-if="!row.isBest && row.savingPerServingCents !== null" class="mt-1 block text-label text-ink-2">Diferencia: {{ formatMXN(row.savingPerServingCents) }}</span></td></tr></tbody>
      </table>
    </div>
    <p class="mt-3 text-body-s text-ink-2">La comparación usa las porciones documentadas de cada presentación. Los importes por porción se redondean para mostrarse.</p>
  </section>
</template>
