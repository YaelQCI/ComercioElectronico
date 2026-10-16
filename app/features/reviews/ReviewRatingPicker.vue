<script setup>
const model = defineModel({ type: String, required: true })
defineProps({ disabled: Boolean })
const preview = ref(0)
const id = useId()
</script>
<template>
  <fieldset :disabled="disabled" @mouseleave="preview = 0">
    <legend class="mb-2 font-semibold">Tu calificación</legend>
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex" @focusout="preview = 0">
        <label v-for="star in 5" :key="star" class="relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink" :class="disabled ? 'cursor-wait opacity-50' : ''" @mouseenter="preview = star">
          <input v-model="model" type="radio" :name="id" :value="String(star)" :aria-label="`${star} ${star === 1 ? 'estrella' : 'estrellas'}`" class="sr-only" @focus="preview = star">
          <svg class="h-8 w-8 text-accent-text" viewBox="0 0 24 24" aria-hidden="true" :fill="star <= (preview || Number(model)) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L2.9 9.6l6.3-.9Z" /></svg>
        </label>
      </div>
      <span class="text-body-s text-ink-2" aria-live="polite">{{ model }} de 5 estrellas</span>
    </div>
    <p class="mt-1 text-body-s text-ink-2">Elige de 1 a 5 estrellas.</p>
  </fieldset>
</template>
