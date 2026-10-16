<script setup>
import LotTraceabilityFields from './LotTraceabilityFields.vue'
const props = defineProps({ lot: { type: Object, required: true } })
const emit = defineEmits(['updated'])
const open = ref(false), busy = ref(false), failure = ref(''), file = ref(null), fileInput = ref(null), removeCertificate = ref(false), draft = reactive({})
const message = useConfirmationMessage()
function begin() { Object.assign(draft, { origin: props.lot.origin ?? '', importedOn: props.lot.importedOn ?? '', customsEntry: props.lot.customsEntry ?? '', reason: '', expectedVersion: props.lot.version }); file.value = null; removeCertificate.value = false; failure.value = ''; open.value = true }
function choose(event) {
  const selected = event.target.files?.[0]
  failure.value = ''
  if (selected && (selected.type !== 'application/pdf' || selected.size > 20 * 1024 * 1024 || !selected.size)) { file.value = null; event.target.value = ''; failure.value = 'Selecciona un PDF de hasta 20 MB.'; return }
  file.value = selected ?? null
}
watch(removeCertificate, value => { if (value) { file.value = null; if (fileInput.value) fileInput.value.value = '' } })
async function save() {
  if (busy.value) return
  busy.value = true; failure.value = ''
  try {
    if (file.value) { const form = new FormData(); for (const [key, value] of Object.entries(draft)) form.append(key, String(value)); form.append('certificate', file.value); await $fetch(`/api/admin/lots/${props.lot.id}/certificate`, { method: 'POST', body: form }) }
    else await $fetch(`/api/admin/lots/${props.lot.id}/traceability`, { method: 'PATCH', body: { ...draft, removeCertificate: removeCertificate.value } })
    open.value = false; emit('updated'); message.value = 'Trazabilidad del lote guardada.'
  } catch (error) { failure.value = error.data?.statusMessage ?? 'No pudimos guardar la trazabilidad. Tus datos siguen en el formulario.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="mt-4 border-t border-line pt-4"><h4 class="font-semibold">Trazabilidad</h4><dl class="mt-2 grid gap-2 text-body-s sm:grid-cols-2"><div><dt class="text-ink-2">Origen</dt><dd>{{ lot.origin || 'Sin documentar' }}</dd></div><div><dt class="text-ink-2">Importación</dt><dd>{{ lot.importedOn || 'Sin documentar' }}</dd></div><div><dt class="text-ink-2">Aduana</dt><dd>{{ lot.customsEntry || 'Sin documentar' }}</dd></div><div><dt class="text-ink-2">Certificado</dt><dd><a v-if="lot.certificateUrl" :href="lot.certificateUrl" target="_blank" rel="noopener" class="relative z-10 inline-flex min-h-11 items-center text-accent-text underline">Ver PDF (nueva pestaña)</a><span v-else>Sin registrar</span></dd></div></dl><UiButton class="relative z-10 mt-3" variant="secondary" aria-haspopup="dialog" @click="begin">Editar trazabilidad y certificado</UiButton></section>
  <UiModal :open="open" :title="`Trazabilidad del lote ${lot.lotCode}`" :busy="busy" @close="open = false"><p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p><p class="mb-4 text-body-s text-ink-2">Registra información documentada. El certificado se guarda en el volumen de archivos del proyecto; reemplazarlo conserva el archivo anterior para auditoría.</p><form @submit.prevent="save"><fieldset :disabled="busy" class="grid gap-4 md:grid-cols-2"><legend class="sr-only">Datos de trazabilidad</legend><LotTraceabilityFields :draft="draft" :prefix="`trace-${lot.id}`" :disabled="busy" /><div class="md:col-span-2"><label :for="`certificate-${lot.id}`" class="mb-2 block text-body-s font-semibold">Certificado de análisis PDF (opcional, hasta 20 MB)</label><input :id="`certificate-${lot.id}`" ref="fileInput" type="file" accept="application/pdf" :disabled="busy || removeCertificate" class="min-h-11 w-full rounded-sm border border-border bg-surface p-2" @change="choose"><label v-if="lot.certificateUrl" class="mt-3 flex min-h-11 items-center gap-3 text-body-s"><input v-model="removeCertificate" type="checkbox" class="h-5 w-5 accent-accent">Retirar el certificado actual de este lote</label></div><UiField :id="`trace-reason-${lot.id}`" v-model="draft.reason" label="Motivo del cambio" required maxlength="500" /><UiButton type="submit" :disabled="busy">Guardar trazabilidad</UiButton></fieldset></form></UiModal>
</template>
