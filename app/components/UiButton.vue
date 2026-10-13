<script setup>
defineProps({
  to: { type: [String, Object], default: undefined },
  disabled: Boolean,
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary', validator: value => ['primary', 'secondary'].includes(value) },
})
const variants = {
  primary: 'border-transparent bg-accent text-accent-ink hover:underline',
  secondary: 'border-border bg-surface text-ink hover:bg-surface-2',
}
const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-5 py-3 text-body-s font-semibold'
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="[base, variants[variant]]"><slot /></NuxtLink>
  <button v-else :type="type" :disabled="disabled" :class="[base, disabled ? 'border-border bg-off-soft text-off' : variants[variant]]"><slot /></button>
</template>
