<script setup>
const token = ref(''), ready = ref(false), pending = ref(false), message = ref(''), failure = ref('')
onMounted(() => { token.value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''; ready.value = true })
async function cancel() {
  if (pending.value) return
  pending.value = true; failure.value = ''
  try { message.value = (await $fetch('/api/restock/cancel', { method: 'POST', body: { token: token.value } })).message }
  catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos cancelar el aviso.' }
  finally { pending.value = false }
}
</script>
<template><section class="mx-auto max-w-store px-4 py-8 md:px-8"><UiBreadcrumbs :items="[{ label: 'Cancelar aviso' }]" /><h1 class="text-display-l font-bold">Cancelar aviso de reposición</h1><p v-if="!ready" class="mt-4" role="status">Cargando enlace…</p><p v-else-if="!token" class="mt-4" role="alert">Abre el enlace completo de cancelación de tu registro.</p><template v-else><p class="mt-4">Confirma para dejar de recibir este aviso. Abrir el enlace no cancela automáticamente.</p><UiButton v-if="!message" class="mt-4" :disabled="pending" @click="cancel">{{ pending ? 'Cancelando…' : 'Cancelar este aviso' }}</UiButton></template><p v-if="message" role="status" class="mt-4 text-ok">{{ message }}</p><p v-if="failure" role="alert" class="mt-4 text-crit">{{ failure }}</p><UiButton class="mt-6" variant="secondary" to="/catalogo">Volver al catálogo</UiButton></section></template>
