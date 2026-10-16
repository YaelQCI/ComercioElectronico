<script setup>
defineProps({ filters: { type: Object, required: true } })
const panel = ref(null)
onMounted(() => {
  const desktop = window.matchMedia('(min-width: 1100px)')
  const reveal = () => { if (desktop.matches && panel.value) panel.value.open = true }
  desktop.addEventListener('change', reveal)
  onBeforeUnmount(() => desktop.removeEventListener('change', reveal))
})
</script>
<template>
  <aside aria-label="Filtros del catálogo" class="min-w-0 lg:sticky lg:top-44">
    <details ref="panel" open class="catalog-filter-panel rounded-sm border border-line bg-surface lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:overscroll-contain">
      <summary class="min-h-11 cursor-pointer px-4 py-3 font-semibold lg:hidden">Filtros ({{ filters.chips.length }})</summary>
      <div v-for="group in filters.groups" v-show="group.options.length" :key="group.key" class="border-b border-line px-4 py-5">
        <fieldset :disabled="filters.pending">
          <legend class="mb-2 font-mono text-label font-semibold uppercase tracking-widest text-ink-2">{{ group.label }}</legend>
          <label v-for="option in group.options" :key="option.value" class="flex min-h-11 cursor-pointer items-center gap-3 text-body-s text-ink-2"><input type="checkbox" :checked="filters.selected(group.key).includes(option.value)" :value="option.value" class="h-5 w-5 shrink-0 accent-accent" @change="filters.toggle(group.key, option.value)"><span>{{ option.label }}</span></label>
        </fieldset>
      </div>
      <form class="p-4" @submit.prevent="filters.applyRange">
        <fieldset :disabled="filters.pending">
          <legend class="mb-3 font-mono text-label font-semibold uppercase tracking-widest text-ink-2">Precio (MXN)</legend>
          <div class="grid min-w-0 grid-cols-2 gap-2">
            <UiField id="minimum-price" v-model="filters.minimum" label="Mínimo" type="number" min="0" step="0.01" :disabled="filters.pending" />
            <UiField id="maximum-price" v-model="filters.maximum" label="Máximo" type="number" min="0" step="0.01" :disabled="filters.pending" />
          </div>
          <p v-if="filters.rangeError" role="alert" class="mt-3 text-body-s text-crit">{{ filters.rangeError }}</p>
          <UiButton type="submit" variant="secondary" class="mt-3" :disabled="filters.pending">Aplicar precios</UiButton>
        </fieldset>
      </form>
    </details>
  </aside>
</template>
<style scoped>
.catalog-filter-panel { scrollbar-color:var(--t-border) var(--t-surface); scrollbar-width:thin; }
</style>
