<script setup>
import { expiryLabel } from '~~/shared/features/inventory/lots.js'
defineProps({ variant: { type: Object, required: true } })
</script>
<template>
  <section class="mt-6 rounded-sm border border-line bg-surface p-4" aria-labelledby="lot-heading">
    <h2 id="lot-heading" class="font-display text-display-m font-bold">Trazabilidad de la presentación</h2>
    <p class="mt-2 text-body-s text-ink-2">Lotes orientativos en orden de caducidad. La asignación final se confirma al reservar el pedido y puede incluir varios lotes.</p>
    <p v-if="!variant.lots.length" class="mt-4 text-body-s text-off">No hay lotes vendibles disponibles.</p>
    <article v-for="lot in variant.lots" :key="lot.id" class="mt-4 border-t border-line pt-4">
      <h3 class="font-mono text-body-s font-semibold">Lote {{ lot.lotCode }}</h3>
      <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-s">
        <dt>SKU</dt><dd class="font-mono">{{ variant.sku }}</dd><dt>Presentación</dt><dd>{{ variant.presentationLabel }} · {{ variant.flavor }}</dd>
        <dt>Caducidad</dt><dd>{{ expiryLabel(lot) }}</dd><dt>Importación</dt><dd>{{ lot.importedOn ?? 'No documentada' }}</dd>
        <dt>Aduana</dt><dd>{{ lot.customsEntry ?? 'No documentada' }}</dd><dt>Origen</dt><dd>{{ lot.origin ?? 'No documentado' }}</dd>
      </dl>
      <a v-if="lot.certificateUrl" :href="lot.certificateUrl" target="_blank" rel="noopener" class="mt-3 inline-flex min-h-11 items-center text-accent-text underline">Ver certificado PDF del lote {{ lot.lotCode }} (nueva pestaña)</a>
      <p v-else class="mt-3 text-body-s text-ink-2">Certificado no disponible para este lote.</p>
    </article>
  </section>
</template>
