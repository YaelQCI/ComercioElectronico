<script setup>
defineOptions({ inheritAttrs: false })
defineProps({ id: { type: String, required: true }, label: { type: String, required: true }, hint: String, error: String, type: { type: String, default: 'text' }, options: Array })
const model = defineModel({ type: [String, Number], default: '' })
const controlClass = 'min-h-11 w-full rounded-sm border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-2 disabled:bg-off-soft disabled:text-off'
</script>
<template>
  <div>
    <label :for="id" class="mb-2 block text-body-s font-semibold">{{ label }}</label>
    <select v-if="options" :id="id" v-model="model" v-bind="$attrs" :class="controlClass" :aria-invalid="error ? true : undefined" :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined">
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <input v-else :id="id" v-model="model" :type="type" v-bind="$attrs" :class="controlClass" :aria-invalid="error ? true : undefined" :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined">
    <p v-if="hint && !error" :id="`${id}-hint`" class="mt-2 text-body-s text-ink-2">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="mt-2 text-body-s text-crit">{{ error }}</p>
  </div>
</template>
