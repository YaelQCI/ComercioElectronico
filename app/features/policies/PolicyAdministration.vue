<script setup>
const { data, status, error, refresh } = await useFetch('/api/admin/policies')
const selected = ref(null), busy = ref(false), failure = ref(''), approved = ref(false), preview = ref(false)
const message = useConfirmationMessage()
const draft = reactive({ title: '', content: '', reason: '' })
function edit(policy) {
  selected.value = { ...policy }
  Object.assign(draft, { title: policy.title, content: policy.content, reason: '' })
  approved.value = false; preview.value = false; failure.value = ''
}
watch(() => [draft.title, draft.content], () => { approved.value = false }, { flush: 'sync' })
async function publish() {
  if (busy.value || !approved.value || !selected.value) return
  busy.value = true; failure.value = ''
  try {
    await $fetch(`/api/policies/${selected.value.slug}`, { method: 'POST', body: { ...draft, approved: true, expectedVersion: selected.value.version } })
    selected.value = null; message.value = 'Política publicada correctamente.'
    await refresh()
  } catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos publicar la política. Tus cambios siguen en el formulario.' }
  finally { busy.value = false }
}
</script>
<template>
  <section aria-label="Administración de políticas">
    <h2 class="text-display-m font-bold">Políticas</h2>
    <p class="mt-3 text-ink-2">Para confirmar pedidos deben estar publicadas las tres políticas. Revisa y aprueba el contenido antes de publicarlo.</p>
    <UiLoading v-if="status === 'pending'" label="Cargando políticas" />
    <div v-else-if="error" role="alert" class="mt-4"><p>No pudimos cargar las políticas.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <ul v-else class="mt-6 grid gap-4"><li v-for="policy in data?.policies" :key="policy.slug" class="rounded-sm border border-border bg-surface p-4">
      <h3 class="font-semibold">{{ policy.title }}</h3>
      <p class="mt-2">{{ policy.published ? 'Publicada' : 'Pendiente de publicación' }} · Versión {{ policy.version }}</p>
      <p v-if="policy.publishedAt" class="mt-2 text-body-s text-ink-2">Fecha de publicación: {{ new Date(policy.publishedAt).toLocaleString('es-MX') }}</p>
      <div class="mt-4 flex flex-wrap gap-3"><UiButton variant="secondary" aria-haspopup="dialog" @click="edit(policy)">{{ policy.version ? 'Revisar y editar' : 'Agregar contenido' }}</UiButton><UiButton v-if="policy.published" variant="secondary" :to="`/politicas/${policy.slug}`">Ver política publicada</UiButton></div>
    </li></ul>
    <UiModal :open="!!selected" :title="selected?.title ?? 'Editar política'" :busy="busy" @close="selected = null">
      <p class="mb-4 text-body-s text-ink-2">Publicar hará visible este contenido y creará una nueva versión. Los pedidos anteriores conservarán la versión que aceptaron. Los cambios sin publicar se descartan al cerrar.</p>
      <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
      <form @submit.prevent="publish"><fieldset :disabled="busy" class="grid gap-4"><legend class="sr-only">Contenido y aprobación de la política</legend>
        <UiField id="policy-title" v-model="draft.title" label="Título" required maxlength="160" />
        <div><label for="policy-content" class="mb-2 block text-body-s font-semibold">Contenido</label><textarea id="policy-content" v-model="draft.content" required maxlength="50000" rows="14" aria-describedby="policy-content-hint" class="min-h-48 w-full rounded-sm border border-border bg-surface px-3 py-2 text-ink" /><p id="policy-content-hint" class="mt-2 text-body-s text-ink-2">Texto sin HTML. Se conservan los saltos de línea. Máximo 50,000 caracteres.</p></div>
        <UiButton variant="secondary" :aria-expanded="preview" aria-controls="policy-preview" @click="preview = !preview">{{ preview ? 'Ocultar vista previa' : 'Ver vista previa' }}</UiButton>
        <section v-if="preview" id="policy-preview" aria-label="Vista previa de política" class="min-w-0 rounded-sm border border-line p-4"><h3 class="font-semibold break-words">{{ draft.title }}</h3><p class="mt-4 whitespace-pre-wrap break-words">{{ draft.content || 'Todavía no has escrito contenido.' }}</p></section>
        <UiField id="policy-reason" v-model="draft.reason" label="Motivo de la publicación" required maxlength="500" />
        <label class="flex min-h-11 items-center gap-3"><input v-model="approved" type="checkbox" required>He revisado y apruebo este contenido para publicarlo.</label>
        <div class="flex flex-wrap gap-3"><UiButton type="submit" :disabled="busy || !approved">{{ busy ? 'Publicando…' : 'Publicar política' }}</UiButton><UiButton variant="secondary" :disabled="busy" @click="selected = null">Cancelar</UiButton><UiButton v-if="failure" variant="secondary" :disabled="busy" @click="refresh">Actualizar lista</UiButton></div>
        <p v-if="failure" class="text-body-s text-ink-2">Si cambió la versión, actualiza la lista y vuelve a abrir la política. Conserva tu texto antes de cerrar el formulario.</p>
      </fieldset></form>
    </UiModal>
  </section>
</template>
