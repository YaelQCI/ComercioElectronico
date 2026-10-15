<script setup>
const emit = defineEmits(['saved'])
const dialog = ref(null), busy = ref(false), failure = ref('')
const emptyAddress = () => ({ recipientName: '', phone: '', postalCode: '', state: '', city: '', district: '', street: '', exteriorNumber: '', interiorNumber: '', label: '', isDefault: false })
const address = reactive(emptyAddress())
const fields = [
  { key: 'label', label: 'Etiqueta (opcional)', optional: true },
  { key: 'recipientName', label: 'Destinatario', autocomplete: 'name' },
  { key: 'phone', label: 'Teléfono', type: 'tel', maxlength: 25, autocomplete: 'tel' },
  { key: 'postalCode', label: 'Código postal', maxlength: 5, pattern: '[0-9]{5}', inputmode: 'numeric', autocomplete: 'postal-code' },
  { key: 'state', label: 'Estado', autocomplete: 'address-level1' },
  { key: 'city', label: 'Ciudad', autocomplete: 'address-level2' },
  { key: 'district', label: 'Colonia' },
  { key: 'street', label: 'Calle', autocomplete: 'address-line1' },
  { key: 'exteriorNumber', label: 'Número exterior' },
  { key: 'interiorNumber', label: 'Número interior (opcional)', optional: true },
]
function open() {
  Object.assign(address, emptyAddress())
  failure.value = ''
  dialog.value.showModal()
}
function close() { if (!busy.value) dialog.value.close() }
async function save() {
  if (busy.value) return
  busy.value = true; failure.value = ''
  try {
    await $fetch('/api/account/addresses', { method: 'POST', body: { ...address } })
    dialog.value.close()
    emit('saved')
  } catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos guardar la dirección. Intenta de nuevo.' }
  finally { busy.value = false }
}
</script>
<template>
  <UiButton aria-haspopup="dialog" aria-controls="account-address-dialog" @click="open">Agregar dirección</UiButton>
  <dialog id="account-address-dialog" ref="dialog" aria-labelledby="account-address-title" aria-describedby="account-address-description" class="account-address-dialog m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-sm border border-border bg-surface p-0 text-ink backdrop:bg-ink/60" @cancel.prevent="close">
    <div class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-4">
      <h2 id="account-address-title" class="text-display-m font-bold">Agregar dirección</h2>
      <UiButton variant="secondary" :disabled="busy" @click="close">Cerrar</UiButton>
    </div>
    <form class="p-5" :aria-busy="busy" @submit.prevent="save">
      <p id="account-address-description" class="mb-4 text-body-s text-ink-2">Completa los datos de entrega. Los campos opcionales están indicados.</p>
      <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
      <fieldset :disabled="busy" class="grid min-w-0 gap-4">
        <legend class="sr-only">Datos de la nueva dirección</legend>
        <UiField v-for="field in fields" :id="`address-${field.key}`" :key="field.key" v-model="address[field.key]" :label="field.label" :type="field.type || 'text'" :required="!field.optional" :maxlength="field.maxlength || 120" :pattern="field.pattern" :inputmode="field.inputmode" :autocomplete="field.autocomplete" :autofocus="field.key === 'recipientName'" />
        <label class="flex min-h-11 items-center gap-3"><input v-model="address.isDefault" type="checkbox">Guardar como predeterminada</label>
        <div class="flex flex-wrap gap-3"><UiButton type="submit" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar dirección' }}</UiButton><UiButton variant="secondary" :disabled="busy" @click="close">Cancelar</UiButton></div>
      </fieldset>
    </form>
  </dialog>
</template>
<style scoped>
:global(body:has(.account-address-dialog[open])) { overflow: hidden; }
</style>
