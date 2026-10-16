<script setup>
defineProps({ product: { type: Object, required: true } })
</script>
<template>
  <section class="mt-16" aria-labelledby="product-information-heading">
    <h2 id="product-information-heading" class="mb-6 font-display text-display-l font-bold uppercase">Detalles del producto</h2>
    <div class="divide-y divide-line rounded-sm border border-line bg-surface">
      <details open class="product-disclosure p-4"><summary class="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-display text-display-m font-bold uppercase">Descripción<span class="disclosure-symbol font-sans text-body-m font-normal text-ink-2" aria-hidden="true" /></summary><p class="max-w-3xl whitespace-pre-line pb-3 pt-2 text-body-s leading-relaxed text-ink-2">{{ product.description }}</p></details>
      <details class="product-disclosure p-4"><summary class="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-display text-display-m font-bold uppercase">Modo de uso<span class="disclosure-symbol font-sans text-body-m font-normal text-ink-2" aria-hidden="true" /></summary><p class="max-w-3xl whitespace-pre-line pb-3 pt-2 text-body-s text-ink-2">{{ product.usageInstructions || 'Modo de uso pendiente de documentar. Consulta la etiqueta del producto.' }}</p></details>
      <details class="product-disclosure p-4"><summary class="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-display text-display-m font-bold uppercase">Ingredientes<span class="disclosure-symbol font-sans text-body-m font-normal text-ink-2" aria-hidden="true" /></summary><p class="max-w-3xl whitespace-pre-line pb-3 pt-2 text-body-s text-ink-2">{{ product.ingredients || 'Ingredientes pendientes de documentar. Consulta la etiqueta del producto.' }}</p></details>
      <details v-if="product.allergenInformation" class="product-disclosure p-4"><summary class="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-display text-display-m font-bold uppercase">Alérgenos<span class="disclosure-symbol font-sans text-body-m font-normal text-ink-2" aria-hidden="true" /></summary><p class="max-w-3xl whitespace-pre-line pb-3 pt-2 text-body-s text-ink-2">{{ product.allergenInformation }}</p></details>
      <details class="product-disclosure p-4"><summary class="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-display text-display-m font-bold uppercase">Envíos y devoluciones<span class="disclosure-symbol font-sans text-body-m font-normal text-ink-2" aria-hidden="true" /></summary><p class="max-w-3xl pt-2 text-body-s text-ink-2">El envío se cotiza durante la compra con tu dirección y los artículos del carrito. Consulta las condiciones vigentes antes de confirmar el pedido.</p><div class="mt-3 flex flex-wrap gap-4 text-body-s"><NuxtLink to="/politicas/terminos" class="inline-flex min-h-11 items-center text-accent-text underline">Términos y condiciones</NuxtLink><NuxtLink to="/politicas/devoluciones" class="inline-flex min-h-11 items-center text-accent-text underline">Devoluciones</NuxtLink></div></details>
    </div>
  </section>
</template>
<style scoped>
summary { list-style:none; }
summary::-webkit-details-marker { display:none; }
.disclosure-symbol::before { content:'+'; }
details[open] > summary .disclosure-symbol::before { content:'−'; }
</style>
