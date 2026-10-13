<script setup>
const store = useRuntimeConfig().public
</script>
<template>
  <footer class="mt-auto bg-ink text-on-ink">
    <div class="mx-auto grid max-w-store gap-8 px-4 py-12 md:grid-cols-3 md:px-8">
      <div>
        <p class="font-display text-display-m font-bold uppercase">The Fitness Stuff</p>
        <p class="mt-3 text-body-s text-on-ink-2">Suplementos y accesorios para el mercado mexicano.</p>
      </div>
      <nav aria-label="Políticas de la tienda">
        <h2 class="font-mono text-label font-semibold uppercase">Información</h2>
        <ul class="mt-3 space-y-3 text-body-s text-on-ink-2">
          <li><NuxtLink to="/politicas/privacidad" class="underline focus-visible:outline-on-ink-accent">Aviso de privacidad</NuxtLink></li>
          <li><NuxtLink to="/politicas/terminos" class="underline focus-visible:outline-on-ink-accent">Términos y condiciones</NuxtLink></li>
          <li><NuxtLink to="/politicas/devoluciones" class="underline focus-visible:outline-on-ink-accent">Devoluciones</NuxtLink></li>
        </ul>
      </nav>
      <div>
        <h2 class="font-mono text-label font-semibold uppercase">Contacto</h2>
        <ul class="mt-3 space-y-3 text-body-s text-on-ink-2">
          <li v-if="store.contactEmail"><a :href="`mailto:${store.contactEmail}`" class="underline focus-visible:outline-on-ink-accent">{{ store.contactEmail }}</a></li>
          <li v-if="store.contactPhone"><a :href="`tel:${store.contactPhone.replace(/[^+\d]/g, '')}`" class="underline focus-visible:outline-on-ink-accent">{{ store.contactPhone }}</a></li>
          <li v-if="store.serviceHours">{{ store.serviceHours }}</li>
          <li v-if="!store.contactEmail && !store.contactPhone && !store.serviceHours">Datos de contacto por confirmar.</li>
        </ul>
      </div>
    </div>
  </footer>
</template>
