<script setup>
import { formErrors, controlLabel } from './form-validation.js'
import { guardNumericEntry } from './numeric-input.js'
const emit = defineEmits(['submit'])
const form = ref(null), errors = shallowRef([]), entryFailure = ref('')
const summaryId = useId()
let validating = false
const described = new Map()
function clearDescriptions() {
  for (const [control, previous] of described) {
    if (previous.invalid == null) control.removeAttribute('aria-invalid')
    else control.setAttribute('aria-invalid', previous.invalid)
    if (previous.description == null) control.removeAttribute('aria-describedby')
    else control.setAttribute('aria-describedby', previous.description)
  }
  described.clear()
}
function updateErrors() {
  clearDescriptions()
  errors.value = form.value ? formErrors(form.value) : []
  errors.value.forEach(({ control }, index) => {
    described.set(control, { invalid: control.getAttribute('aria-invalid'), description: control.getAttribute('aria-describedby') })
    control.setAttribute('aria-invalid', 'true')
    control.setAttribute('aria-describedby', `${control.getAttribute('aria-describedby') || ''} ${summaryId}-${index}`.trim())
  })
}
function focusError() { nextTick(() => { const control = errors.value[0]?.control; control?.focus(); control?.scrollIntoView({ block: 'center' }) }) }
function reportValidity() {
  validating = true
  for (const control of form.value?.elements ?? []) if (control.willValidate) control.checkValidity()
  validating = false
  updateErrors()
  if (errors.value.length) focusError()
  return !errors.value.length
}
function submit(event) { entryFailure.value = ''; if (reportValidity()) emit('submit', event) }
function invalid() { if (!validating) { updateErrors(); focusError() } }
function changed() { entryFailure.value = ''; if (errors.value.length) updateErrors() }
function numericEntry(event) { const message = guardNumericEntry(event); if (message) entryFailure.value = `${controlLabel(event.target)}: ${message}` }
function reset() { clearDescriptions(); errors.value = []; entryFailure.value = '' }
onMounted(() => { form.value.reportValidity = reportValidity })
onBeforeUnmount(clearDescriptions)
defineExpose({ reportValidity })
</script>
<template>
  <form ref="form" data-form-validation novalidate @submit.prevent="submit" @invalid.capture.prevent="invalid" @input="changed" @change="changed" @beforeinput="numericEntry" @paste="numericEntry" @reset="reset">
    <p v-if="entryFailure" role="alert" class="mb-4 text-crit" style="grid-column: 1 / -1; flex-basis: 100%">{{ entryFailure }}</p>
    <div v-if="errors.length" data-form-error-summary role="alert" class="mb-4 w-full rounded-sm border border-crit bg-surface p-4 text-crit" style="grid-column: 1 / -1; flex-basis: 100%">
      <p class="font-semibold">No se pudo continuar. Corrige {{ errors.length === 1 ? 'el siguiente campo' : 'los siguientes campos' }}:</p>
      <ul class="mt-2 max-h-56 space-y-1 overflow-y-auto">
        <li v-for="(error, index) in errors" :id="`${summaryId}-${index}`" :key="index"><button type="button" class="min-h-11 w-full text-left underline focus-visible:outline-2 focus-visible:outline-offset-2" @click="error.control.focus(); error.control.scrollIntoView({ block: 'center' })">{{ error.message }}</button></li>
      </ul>
    </div>
    <slot />
  </form>
</template>
