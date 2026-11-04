<script setup>
import { shippingProgress } from '~~/shared/features/shipping/shipping-policy.js'
import { formatMXN } from '~~/shared/features/pricing/prices.js'
const props = defineProps({ baseCents: { type: String, required: true }, freeShipping: Boolean })
const progress = computed(() => shippingProgress(props.baseCents, null, props.freeShipping))
</script>
<template><section class="mt-6 rounded-sm border border-line bg-surface p-4" aria-label="Umbral de envío gratis"><p v-if="freeShipping" class="text-ok">Tu cupón incluye envío gratis, sujeto a cobertura y cotización del servicio.</p><p v-else-if="progress.eligible" class="text-ok">Productos elegibles para envío gratis, sujeto a cobertura y cotización del servicio.</p><p v-else>Te faltan {{ formatMXN(progress.remainingCents) }} en productos para envío gratis.</p><progress class="mt-3 h-3 w-full accent-accent" :value="progress.percent" max="100" aria-label="Progreso hacia envío gratis" /><p class="mt-2 text-body-s text-ink-2"><template v-if="!freeShipping">Desde {{ formatMXN(progress.thresholdCents) }} después de ofertas y cupón, antes de puntos. </template>La cotización sigue siendo necesaria para comprobar cobertura; no hay tarifa ni fecha confirmada todavía.</p></section></template>
