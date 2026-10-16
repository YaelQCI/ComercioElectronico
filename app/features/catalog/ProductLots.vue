<script setup>
import { expiryLabel } from '~~/shared/features/inventory/lots.js'
defineProps({ variant: { type: Object, required: true } })
</script>
<template>
  <section class="mt-16 rounded-sm border border-line bg-surface p-4 md:p-6" aria-labelledby="lot-heading">
    <h2 id="lot-heading" class="font-mono text-label font-semibold uppercase tracking-widest text-accent-text">Trazabilidad del lote</h2>
    <p v-if="!variant.lots.length" class="mt-4 text-body-s text-off">No hay lotes vendibles disponibles.</p>
    <article v-for="lot in variant.lots" :key="lot.id" class="mt-4 border-t border-line pt-4">
      <h3 v-if="variant.lots.length > 1" class="mb-3 font-mono text-body-s font-semibold">Lote {{ lot.lotCode }}</h3>
      <dl class="divide-y divide-line font-mono text-label text-ink-2">
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">SKU</dt><dd class="min-w-0 break-all text-right">{{ variant.sku }}</dd></div>
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">Lote</dt><dd>{{ lot.lotCode }}</dd></div>
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">Fecha de importación</dt><dd>{{ lot.importedOn ?? 'No documentada' }}</dd></div>
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">Aduana de entrada</dt><dd>{{ lot.customsEntry ?? 'No documentada' }}</dd></div>
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">Caducidad</dt><dd>{{ expiryLabel(lot) }}</dd></div>
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">Origen</dt><dd>{{ lot.origin ?? 'No documentado' }}</dd></div>
        <div class="flex flex-wrap justify-between gap-3 py-3"><dt class="uppercase tracking-wide">Presentación</dt><dd>{{ variant.presentationLabel }} · {{ variant.flavor }}<template v-if="variant.servings"> · {{ variant.servings }} porciones</template></dd></div>
        <div class="flex flex-wrap items-center justify-between gap-3 py-2"><dt class="uppercase tracking-wide">Certificado de análisis</dt><dd><a v-if="lot.certificateUrl" :href="lot.certificateUrl" target="_blank" rel="noopener" class="inline-flex min-h-11 items-center text-accent-text underline">Ver PDF del lote {{ lot.lotCode }} (nueva pestaña)</a><span v-else>No disponible para este lote</span></dd></div>
      </dl>
    </article>
    <p class="mt-4 max-w-3xl text-body-s text-ink-2">Lotes orientativos en orden de caducidad. La asignación final se confirma al reservar el pedido y puede incluir varios lotes.</p>
  </section>
</template>
