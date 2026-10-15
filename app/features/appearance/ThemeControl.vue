<script setup>
const props = defineProps({ preference: { type: String, default: 'system' }, refreshSession: { type: Function, required: true } })
const selected = ref(props.preference), busy = ref(false), failure = ref(''), message = ref('')
watch(() => props.preference, value => { selected.value = value })
async function save() {
  if (busy.value) return
  busy.value = true; failure.value = ''; message.value = ''
  try {
    await $fetch('/api/account/theme', { method: 'PATCH', body: { themePreference: selected.value } })
    await props.refreshSession()
    message.value = 'Apariencia guardada en tu cuenta.'
  } catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos guardar la apariencia. Intenta de nuevo.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="mt-8" aria-labelledby="account-appearance-heading">
    <h2 id="account-appearance-heading" class="text-display-m font-bold">Apariencia</h2>
    <p class="mt-3 text-ink-2">El tema se guarda en tu cuenta y se aplica al iniciar sesión en cualquier dispositivo. La opción del sistema sigue la apariencia del dispositivo que estés usando.</p>
    <form class="mt-4 grid gap-4" @submit.prevent="save">
      <UiField id="account-theme" v-model="selected" label="Tema de la plataforma" :options="[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Del sistema' }]" :disabled="busy" />
      <UiButton type="submit" :disabled="busy || selected === preference">{{ busy ? 'Guardando…' : 'Guardar apariencia' }}</UiButton>
    </form>
    <p v-if="failure" role="alert" class="mt-3 text-crit">{{ failure }}</p>
    <p v-if="message" role="status" class="mt-3 text-ok">{{ message }}</p>
  </section>
</template>
