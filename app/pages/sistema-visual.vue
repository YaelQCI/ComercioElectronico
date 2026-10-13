<script setup>
// Selector de demostración; persistencia y selector global pertenecen a #22.
const theme = ref('light')
useHead(() => ({ htmlAttrs: { 'data-theme': theme.value } }))
const surfaces = [
  ['paper', 'bg-paper text-ink'], ['surface', 'bg-surface text-ink'],
  ['surface-2', 'bg-surface-2 text-ink'], ['accent', 'bg-accent text-accent-ink'],
  ['ink', 'bg-ink text-on-ink'], ['packshot', 'bg-packshot text-packshot-ink'],
]
</script>

<template>
  <main class="mx-auto max-w-store px-4 py-8 md:px-8">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
      <div>
        <NuxtLink to="/" class="text-accent-text underline">The Fitness Stuff</NuxtLink>
        <h1 class="mt-2 text-display-l font-bold">Sistema visual</h1>
      </div>
      <label class="flex items-center gap-3" for="theme">
        Tema de la muestra
        <select id="theme" v-model="theme" class="rounded-sm border border-border bg-surface px-3 py-2 text-ink">
          <option value="light">Claro</option><option value="dark">Oscuro</option>
        </select>
      </label>
    </header>
    <section class="mt-8" aria-labelledby="palette">
      <h2 id="palette" class="text-display-m font-bold">Superficies y colores</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="[name, classes] in surfaces" :key="name" :class="classes" class="rounded-sm border border-border p-6 font-mono">
          {{ name }}
        </div>
      </div>
      <p class="mt-4 text-ink-2">Las fotografías de producto conservan un fondo blanco en ambos temas.</p>
    </section>
    <section class="mt-8 grid gap-6 md:grid-cols-2" aria-label="Controles y estados">
      <div class="rounded-sm border border-border bg-surface p-6">
        <h2 class="text-display-m font-bold">Controles</h2>
        <label for="search" class="mt-4 block">Buscar producto</label>
        <input id="search" type="search" placeholder="Nombre o presentación" class="mt-2 w-full rounded-sm border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-2">
        <div class="mt-4 flex flex-wrap gap-4">
          <button type="button" class="min-h-11 rounded-sm bg-accent px-5 py-3 font-semibold text-accent-ink hover:underline">Acción principal</button>
          <button type="button" class="min-h-11 rounded-sm border border-border bg-surface px-5 py-3 text-ink hover:bg-surface-2">Acción secundaria</button>
          <button type="button" disabled class="min-h-11 rounded-sm border border-border bg-off-soft px-5 py-3 text-off">No disponible</button>
        </div>
        <p class="mt-4 text-accent-text">Acento textual accesible</p>
      </div>
      <div class="rounded-sm border border-border bg-surface p-6">
        <h2 class="text-display-m font-bold">Estados con texto</h2>
        <ul class="mt-4 space-y-3">
          <li class="rounded-sm bg-ok-soft px-3 py-2 text-ok">✓ Disponible</li>
          <li class="rounded-sm bg-warn-soft px-3 py-2 text-warn">! Pocas piezas</li>
          <li class="rounded-sm bg-off-soft px-3 py-2 text-off">— Agotado</li>
          <li class="rounded-sm bg-crit-soft px-3 py-2 text-crit">× No se pudo completar la operación</li>
        </ul>
        <table class="mt-6 w-full border-collapse text-left">
          <caption class="mb-2 text-left text-ink-2">Ejemplo de cifras tabulares</caption>
          <thead><tr class="border-b border-line"><th scope="col" class="py-2">Dato</th><th scope="col" class="py-2 text-right">Importe</th></tr></thead>
          <tbody><tr><th scope="row" class="py-2 font-normal">Ejemplo visual</th><td class="py-2 text-right font-mono tabular-nums">$1,499.00</td></tr></tbody>
        </table>
      </div>
    </section>
    <footer class="mt-8 rounded-sm bg-ink p-6 text-on-ink">
      <p class="font-display text-display-m">Superficie de marca</p>
      <p class="text-on-ink-2">Texto secundario sobre tinta</p>
      <p class="text-on-ink-3">Texto de apoyo sobre tinta</p>
      <p class="text-on-ink-accent">Acento sobre tinta</p>
    </footer>
  </main>
</template>
