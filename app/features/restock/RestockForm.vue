<script setup>
const props = defineProps({ variantId: { type: String, required: true }, sku: { type: String, required: true }, presentation: { type: String, required: true }, compact: Boolean })
const id = useId()
const email = ref(''), consent = ref(false), pending = ref(false), message = useConfirmationMessage(), failure = ref(''), cancelPath = ref(null)
async function subscribe() {
  if (pending.value) return
  pending.value = true; failure.value = ''; message.value = ''; cancelPath.value = null
  try {
    const result = await $fetch('/api/restock', { method: 'POST', body: { variantId: props.variantId, email: email.value, consent: consent.value } })
    message.value = result.message; cancelPath.value = result.cancelPath
  } catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos registrar el aviso. Intenta de nuevo.' }
  finally { pending.value = false }
}
</script>
<template><details :class="compact ? 'rounded-sm bg-surface' : 'mt-4 rounded-sm border border-line bg-surface p-3'"><summary class="min-h-11 cursor-pointer font-semibold" :class="compact ? 'flex items-center justify-center rounded-sm border border-border px-5 py-3 text-body-s hover:bg-surface-2' : 'py-2'">Avisarme cuando llegue</summary><p class="mt-2 text-body-s">{{ presentation }} · SKU {{ sku }}. Usaremos tu correo únicamente para un aviso de reposición de esta presentación. El proveedor de correo todavía está pendiente; no hay envío de avisos habilitado.</p><form class="mt-3 space-y-3" @submit.prevent="subscribe"><UiField :id="`restock-email-${id}`" v-model="email" label="Correo para el aviso" type="email" maxlength="254" autocomplete="email" required :disabled="pending" /><label class="flex min-h-11 items-center gap-3 text-body-s"><input v-model="consent" type="checkbox" required :disabled="pending" class="h-5 w-5 accent-accent">Acepto registrar mi interés para este aviso por correo.</label><UiButton type="submit" variant="secondary" :disabled="pending || !consent">{{ pending ? 'Registrando…' : 'Registrar interés' }}</UiButton></form><p v-if="failure" role="alert" class="mt-3 text-body-s text-crit">{{ failure }}</p><NuxtLink v-if="cancelPath" :to="cancelPath" class="mt-3 inline-flex min-h-11 items-center underline">Cancelar este registro</NuxtLink></details></template>
