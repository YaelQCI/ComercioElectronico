<script setup>
const store = useRuntimeConfig().public
const year = new Date().getFullYear()
</script>
<template>
  <footer class="mt-auto border-t-2 border-accent bg-ink text-on-ink">
    <div class="mx-auto grid max-w-store gap-10 px-4 py-12 sm:grid-cols-2 md:px-8 md:py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div>
        <p class="font-display text-display-m font-bold uppercase">The Fitness Stuff</p>
        <p class="mt-3 max-w-xs text-body-s text-on-ink-2">Suplementos y accesorios para el mercado mexicano. Consulta lotes y caducidad antes de comprar.</p>
      </div>
      <nav aria-label="Políticas de la tienda">
        <h2 class="font-mono text-label font-semibold uppercase tracking-widest">Legal</h2>
        <ul class="mt-3 space-y-3 text-body-s text-on-ink-2">
          <li><NuxtLink to="/politicas/privacidad" class="underline focus-visible:outline-on-ink-accent">Aviso de privacidad</NuxtLink></li>
          <li><NuxtLink to="/politicas/terminos" class="underline focus-visible:outline-on-ink-accent">Términos y condiciones</NuxtLink></li>
          <li><NuxtLink to="/politicas/devoluciones" class="underline focus-visible:outline-on-ink-accent">Devoluciones</NuxtLink></li>
        </ul>
      </nav>
      <div><h2 class="font-mono text-label font-semibold uppercase tracking-widest">Pago</h2><p class="mt-3 flex items-center gap-2 text-body-s text-on-ink-2"><UiIcon name="card" class="shrink-0" />Pago seguro con Stripe</p></div>
      <div>
        <h2 class="font-mono text-label font-semibold uppercase tracking-widest">Contacto</h2>
        <ul class="mt-3 space-y-3 text-body-s text-on-ink-2">
          <li v-if="store.contactEmail"><a :href="`mailto:${store.contactEmail}`" class="underline focus-visible:outline-on-ink-accent">{{ store.contactEmail }}</a></li>
          <li v-if="store.contactPhone"><a :href="`tel:${store.contactPhone.replace(/[^+\d]/g, '')}`" class="underline focus-visible:outline-on-ink-accent">{{ store.contactPhone }}</a></li>
          <li v-if="store.serviceHours">{{ store.serviceHours }}</li>
          <li v-if="!store.contactEmail && !store.contactPhone && !store.serviceHours">Datos de contacto por confirmar.</li>
          <li><NuxtLink to="/contacto" class="underline focus-visible:outline-on-ink-accent">Contactar a la tienda</NuxtLink></li>
        </ul>
      </div>
    </div>
    <div class="mx-auto max-w-store px-4 pb-8 md:px-8"><p class="border-t border-current pt-5 font-mono text-label text-on-ink-2">© {{ year }} The Fitness Stuff · México</p></div>
  </footer>
</template>
