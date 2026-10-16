<script setup>
const model = defineModel({ type: String, default: '' })
const props = defineProps({ brands: { type: Array, default: () => [] }, current: Object, prefix: { type: String, required: true }, disabled: Boolean })
const emit = defineEmits(['created'])
const open = ref(false), busy = ref(false), failure = ref(''), draft = reactive({ name: '', slug: '', reason: '' })
const message = useConfirmationMessage()
const options = computed(() => [{ value: '', label: 'Sin marca registrada' }, ...(props.current && !props.brands.some(brand => brand.id === props.current.id) ? [{ value: props.current.id, label: `${props.current.name} (inactiva)` }] : []), ...props.brands.map(brand => ({ value: brand.id, label: brand.name }))])
async function create() {
  if (busy.value) return
  busy.value = true; failure.value = ''
  try { const result = await $fetch('/api/admin/catalog/brands', { method: 'POST', body: { ...draft } }); emit('created', result); model.value = result.id; Object.assign(draft, { name: '', slug: '', reason: '' }); open.value = false; message.value = 'Marca registrada.' }
  catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos registrar la marca.' }
  finally { busy.value = false }
}
</script>
<template>
  <div class="min-w-0"><UiField :id="`${prefix}-brand`" v-model="model" label="Marca (opcional)" :options="options" :disabled="disabled" /><UiButton class="mt-3" variant="secondary" :disabled="disabled" aria-haspopup="dialog" @click="open = true">Registrar marca</UiButton></div>
  <Teleport to="body"><UiModal :open="open" title="Registrar marca" :busy="busy" @close="open = false"><p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p><form class="grid gap-4" @submit.prevent="create"><UiField :id="`${prefix}-brand-name`" v-model="draft.name" label="Nombre de marca" required maxlength="120" :disabled="busy" /><UiField :id="`${prefix}-brand-slug`" v-model="draft.slug" label="Identificador de marca" pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxlength="150" :disabled="busy" /><UiField :id="`${prefix}-brand-reason`" v-model="draft.reason" label="Motivo del registro" required maxlength="500" :disabled="busy" /><UiButton type="submit" :disabled="busy">Guardar marca</UiButton></form></UiModal></Teleport>
</template>
