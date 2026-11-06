<script setup>
import { controlError } from './form-validation.js'
import { guardNumericEntry, numericValueError } from './numeric-input.js'
import { emailFormatError } from '~~/shared/features/notifications/email.js'

defineOptions({ inheritAttrs: false })
const props = defineProps({ id: { type: String, required: true }, label: { type: String, required: true }, hint: String, error: String, type: { type: String, default: 'text' }, options: Array, passwordToggle: Boolean, required: Boolean })
const model = defineModel({ type: [String, Number], default: '' })
const control = ref(null), validationError = ref(''), numericFailure = ref('')
const emailFailure = computed(() => props.type === 'email' && model.value ? emailFormatError(String(model.value)) : '')
watchEffect(() => { control.value?.setCustomValidity(props.error || numericFailure.value || emailFailure.value) })
const visibleError = computed(() => props.error || validationError.value)
function validate(event) { validationError.value = controlError(event.target) }
function correct(event) {
  numericFailure.value = numericValueError(event.target)
  event.target.setCustomValidity(props.error || numericFailure.value || emailFailure.value)
  if (validationError.value || numericFailure.value || ['number', 'email'].includes(event.target.type)) validate(event)
}
function numericEntry(event) {
  const message = guardNumericEntry(event)
  if (message) validationError.value = `${props.label}: ${message}`
}
const passwordVisible = ref(false)
const controlClass = 'min-h-11 w-full rounded-sm border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-2 disabled:bg-off-soft disabled:text-off'
</script>
<template>
  <div>
    <label :for="id" class="mb-2 block text-body-s font-semibold">{{ label }}<span v-if="required" aria-hidden="true" class="text-crit"> *</span></label>
    <select ref="control" v-if="options" :id="id" v-model="model" v-bind="$attrs" :required="required" :class="controlClass" :aria-invalid="visibleError ? true : undefined" :aria-describedby="visibleError ? `${id}-error` : hint ? `${id}-hint` : undefined" @invalid.prevent="validate" @blur="validate" @input="correct" @change="correct">
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <div v-else class="relative">
      <input @beforeinput="numericEntry" @paste="numericEntry" ref="control" :data-password-field="type === 'password' ? 'true' : undefined" :id="id" v-model="model" :type="type === 'password' && passwordToggle && passwordVisible ? 'text' : type" v-bind="$attrs" :required="required" :class="[controlClass, { 'pr-14': type === 'password' && passwordToggle }]" :aria-invalid="visibleError ? true : undefined" :aria-describedby="visibleError ? `${id}-error` : hint ? `${id}-hint` : undefined" @invalid.prevent="validate" @blur="validate" @input="correct" @change="correct">
      <button v-if="type === 'password' && passwordToggle" type="button" class="absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:text-off" :disabled="$attrs.disabled" :aria-controls="id" :aria-label="`${passwordVisible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`" @click="passwordVisible = !passwordVisible">
        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path v-if="passwordVisible" d="m3 3 18 18" />
        </svg>
      </button>
    </div>
    <p v-if="hint && !visibleError" :id="`${id}-hint`" class="mt-2 text-body-s text-ink-2">{{ hint }}</p>
    <p v-if="visibleError" :id="`${id}-error`" data-field-error role="alert" class="mt-2 text-body-s text-crit">{{ visibleError }}</p>
  </div>
</template>
