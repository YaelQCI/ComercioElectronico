<script setup>
const open = ref(false)
</script>
<template>
  <section class="border-t-4 border-accent bg-ink p-6 text-on-ink md:p-12" aria-labelledby="price-guarantee-heading">
    <span class="inline-block bg-on-ink px-2 py-1 font-mono text-label font-semibold uppercase tracking-widest text-ink">Price match</span>
    <h2 id="price-guarantee-heading" class="mt-3 font-display text-display-l font-bold uppercase leading-tight">Price match guarantee</h2>
    <p class="mt-4 max-w-2xl text-body-m text-on-ink-2">Si encuentras el mismo producto más barato en otra tienda en línea con envío a México, nos escribes con el link o la captura y te devolvemos la diferencia dentro de 7 días después de tu compra.</p>
    <button type="button" aria-haspopup="dialog" class="mt-8 inline-flex min-h-11 items-center justify-center rounded-sm border border-current px-5 py-3 text-body-s font-semibold hover:underline focus-visible:outline-on-ink-accent" @click="open = true">Leer condiciones</button>
    <UiModal :open="open" title="Price match guarantee" @close="open = false">
      <p>Si encuentras el mismo producto más barato en otra tienda en línea con envío a México, comparte el enlace o una captura dentro de los 7 días posteriores a tu compra para solicitar la devolución de la diferencia.</p>
      <p class="mt-4 text-body-s text-ink-2">Contacta a la tienda para revisar tu solicitud y la información del producto y de tu pedido.</p>
      <div class="mt-6 flex flex-wrap gap-3"><UiButton to="/contacto" @click="open = false">Contactar a la tienda</UiButton><UiButton variant="secondary" @click="open = false">Cerrar</UiButton></div>
    </UiModal>
  </section>
</template>
