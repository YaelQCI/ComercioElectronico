<script setup>
const open = ref(false)
const emit = defineEmits(['created'])
const name = ref(''), slug = ref(''), reason = ref(''), busy = ref(false), failure = ref(''), message = ref('')
async function create() {
  if (busy.value) return
  busy.value = true; failure.value = ''; message.value = ''
  try {
    await $fetch('/api/admin/categories', { method: 'POST', body: { name: name.value, slug: slug.value, reason: reason.value } })
    name.value = ''; slug.value = ''; reason.value = ''; message.value = 'Tipo creado. Ya puedes seleccionarlo en la clasificación del producto.'
    open.value = false
    emit('created')
  } catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos crear la categoría.' }
  finally { busy.value = false }
}
</script>
<template>
  <UiButton class="my-4 mr-3" variant="secondary" aria-haspopup="dialog" @click="open = true">Crear tipo de suplemento o categoría</UiButton>
  <p v-if="message" role="status" class="my-3 text-ok">{{ message }}</p>
  <UiModal :open="open" title="Crear tipo de suplemento o categoría" :busy="busy" @close="open = false">
    <p class="my-3 text-body-s text-ink-2">Registra los tipos que utiliza tu catálogo. Luego podrás asignarlos al crear o editar productos.</p>
    <p v-if="failure" role="alert" class="my-3 text-crit">{{ failure }}</p><p v-if="message" role="status" class="my-3 text-ok">{{ message }}</p>
    <form @submit.prevent="create"><fieldset :disabled="busy" class="grid min-w-0 gap-4 md:grid-cols-2"><legend class="sr-only">Crear tipo de suplemento o categoría</legend><UiField id="category-name" v-model="name" label="Nombre del tipo o categoría" required maxlength="120" /><UiField id="category-slug" v-model="slug" label="Identificador de URL de la categoría" hint="Minúsculas, números y guiones." pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxlength="150" /><UiField id="category-reason" v-model="reason" label="Motivo del alta de categoría" required maxlength="500" /><UiButton type="submit" :disabled="busy">Crear tipo o categoría</UiButton></fieldset></form>
  </UiModal>
</template>
