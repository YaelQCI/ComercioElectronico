<script setup>
const ready = ref(false)
const theme = ref('light')
const preference = ref(null)
function update() {
  const current = window.fitnessTheme.get()
  theme.value = current.theme
  preference.value = current.preference
}
onMounted(() => {
  update()
  ready.value = true
  window.addEventListener('fitness-theme', update)
})
onBeforeUnmount(() => { window.removeEventListener('fitness-theme', update) })
function toggle() { window.fitnessTheme.set(theme.value === 'dark' ? 'light' : 'dark') }
function system() { window.fitnessTheme.set(null) }
</script>
<template>
  <div class="flex flex-wrap items-center gap-2 text-body-s">
    <button type="button" :disabled="!ready" :aria-pressed="ready ? theme === 'dark' : undefined" class="inline-flex min-h-11 items-center rounded-sm border border-border px-3 hover:bg-surface-2" @click="toggle">
      {{ ready ? (theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro') : 'Tema' }}
    </button>
    <button v-if="ready && preference" type="button" class="min-h-11 px-2 text-accent-text underline" @click="system">Usar tema del sistema</button>
    <span class="sr-only" role="status">{{ ready ? `Tema ${theme === 'dark' ? 'oscuro' : 'claro'}; ${preference ? 'elección guardada' : 'según el sistema'}.` : '' }}</span>
  </div>
</template>
