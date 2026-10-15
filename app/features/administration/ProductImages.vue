<script setup>
const props = defineProps({ product: { type: Object, required: true } })
const emit = defineEmits(['updated'])
const fileInput = ref(null), file = ref(null), preview = ref(''), kind = ref('FRONT'), alt = ref(''), reason = ref('')
const busy = ref(false), failure = ref(''), message = ref('')
const kinds = [{ value: 'FRONT', label: 'Imagen frontal' }, { value: 'NUTRITION', label: 'Información nutricional' }, { value: 'GALLERY', label: 'Galería' }]
function clearPreview() { if (preview.value) URL.revokeObjectURL(preview.value); preview.value = '' }
function choose(event) {
  clearPreview(); failure.value = ''; message.value = ''; file.value = null
  const chosen = event.target.files?.[0]
  if (!chosen) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type) || !chosen.size || chosen.size > 5*1024*1024) {
    failure.value = 'Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.'
    event.target.value = ''; return
  }
  file.value = chosen; preview.value = URL.createObjectURL(chosen)
}
watch(() => props.product.id, () => {
  clearPreview(); file.value = null; alt.value = ''; reason.value = ''; failure.value = ''; message.value = ''
  kind.value = props.product.images?.some(image => image.kind === 'FRONT') ? 'GALLERY' : 'FRONT'
  if (fileInput.value) fileInput.value.value = ''
}, { immediate: true })
onBeforeUnmount(clearPreview)
async function upload() {
  if (busy.value || !file.value) return
  busy.value = true; failure.value = ''; message.value = ''
  const productId = props.product.id
  try {
    const form = new FormData()
    form.append('image', file.value); form.append('kind', kind.value); form.append('alt', alt.value); form.append('reason', reason.value)
    await $fetch(`/api/admin/catalog/${productId}/images`, { method: 'POST', body: form })
    clearPreview(); file.value = null; if (fileInput.value) fileInput.value.value = ''; alt.value = ''; reason.value = ''
    message.value = 'Imagen guardada. Si es la frontal, ya puedes publicar el producto.'
    emit('updated', productId)
  } catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos cargar la imagen. Conservamos los datos para reintentar.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="mt-8 border-t border-line pt-6" aria-label="Imágenes del producto">
    <h3 class="text-display-s font-bold">Imágenes</h3>
    <p class="my-3 text-body-s text-ink-2">Agrega fotografías del producto. Necesitas una imagen frontal para publicarlo. Al subir otra frontal, la anterior se conserva en la galería.</p>
    <p v-if="!product.images?.length" class="my-3">Este producto todavía no tiene imágenes.</p>
    <ul class="my-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><li v-for="image in product.images" :key="image.id" class="rounded-sm border border-border p-3"><img :src="image.url" :alt="image.alt" class="h-40 w-full rounded-sm bg-packshot object-contain" loading="lazy"><p class="mt-2 font-semibold">{{ kinds.find(item => item.value === image.kind)?.label }}</p><p class="break-words text-body-s">{{ image.alt }}</p></li></ul>
    <p v-if="failure" role="alert" class="my-3 text-crit">{{ failure }}</p><p v-if="message" role="status" class="my-3 text-ok">{{ message }}</p>
    <form v-if="!product.deactivated" @submit.prevent="upload">
      <fieldset :disabled="busy" class="grid min-w-0 gap-4 md:grid-cols-2">
        <legend class="sr-only">Agregar una imagen al producto</legend>
        <div class="md:col-span-2"><label :for="`product-image-${product.id}`" class="mb-2 block text-body-s font-semibold">Archivo de imagen</label><input :id="`product-image-${product.id}`" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" required :aria-describedby="`product-image-hint-${product.id}`" class="min-h-11 w-full rounded-sm border border-border bg-surface p-2" @change="choose"><p :id="`product-image-hint-${product.id}`" class="mt-2 text-body-s text-ink-2">JPG, PNG o WebP, hasta 5 MB. Máximo 20 imágenes por producto.</p></div>
        <img v-if="preview" :src="preview" alt="Vista previa de la imagen seleccionada" class="h-40 w-full bg-packshot object-contain md:col-span-2">
        <UiField :id="`image-kind-${product.id}`" v-model="kind" label="Tipo de imagen" :options="kinds" required />
        <UiField :id="`image-alt-${product.id}`" v-model="alt" label="Descripción de la imagen" hint="Describe lo que muestra para las personas que utilizan lectores de pantalla." required maxlength="500" />
        <UiField :id="`image-reason-${product.id}`" v-model="reason" label="Motivo de la carga" required maxlength="500" />
        <UiButton type="submit" :disabled="busy || !file || (product.images?.length || 0) >= 20">{{ busy ? 'Cargando imagen…' : 'Guardar imagen' }}</UiButton>
      </fieldset>
    </form>
  </section>
</template>
