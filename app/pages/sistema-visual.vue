<script setup>
import ThemeControl from '~/features/appearance/ThemeControl.vue'
const sampleQuery = ref('')
definePageMeta({ layout: false })
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
      <ThemeControl />
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
        <UiField id="search" v-model="sampleQuery" label="Buscar producto" type="search" placeholder="Nombre o presentación" class="mt-4" hint="Muestra visual: este campo no consulta el catálogo." />
        <div class="mt-4 flex flex-wrap gap-4">
          <UiButton>Acción principal</UiButton>
          <UiButton variant="secondary">Acción secundaria</UiButton>
          <UiButton disabled>No disponible</UiButton>
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
        <UiTable class="mt-6" caption="Ejemplo de cifras tabulares, datos ilustrativos" :columns="[{ key: 'label', label: 'Dato' }, { key: 'amount', label: 'Importe', numeric: true }]" :rows="[{ id: 'sample', label: 'Ejemplo visual', amount: '$1,499.00' }]" />
      </div>
    </section>
    <section class="mt-8 max-w-sm" aria-label="Tarjeta de referencia del prototipo">
      <UiCard title="Creatina monohidratada" image="/images/references/creatina-monohidratada-300g.webp" image-alt="Bote de creatina monohidratada del prototipo">
        <p class="text-body-s text-ink-2">Referencia visual del prototipo; no es un producto publicado para venta.</p>
        <template #actions><UiButton disabled>Venta no habilitada</UiButton></template>
      </UiCard>
    </section>
    <footer class="mt-8 rounded-sm bg-ink p-6 text-on-ink">
      <p class="font-display text-display-m">Superficie de marca</p>
      <p class="text-on-ink-2">Texto secundario sobre tinta</p>
      <p class="text-on-ink-3">Texto de apoyo sobre tinta</p>
      <p class="text-on-ink-accent">Acento sobre tinta</p>
    </footer>
  </main>
</template>
