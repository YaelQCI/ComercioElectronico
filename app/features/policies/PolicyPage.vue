<script setup>
const props = defineProps({ slug: { type: String, required: true } })
const names = { privacidad: 'Aviso de privacidad', terminos: 'Términos y condiciones', devoluciones: 'Devoluciones' }
if (!names[props.slug]) throw createError({ statusCode: 404, statusMessage: 'Página no encontrada' })
const { data, error, status, refresh } = await useFetch(() => `/api/policies/${props.slug}`)
const title = computed(() => data.value?.policy?.title ?? names[props.slug])
useHead(() => ({ title: `${title.value} — The Fitness Stuff` }))
</script>
<template><section class="mx-auto max-w-store px-4 py-12 md:px-8"><UiBreadcrumbs :items="[{ label: title }]" /><h1 class="text-display-l font-bold">{{ title }}</h1><UiLoading v-if="status === 'pending'" label="Cargando política" /><div v-else-if="error" role="alert" class="mt-6"><p>No pudimos consultar el contenido vigente.</p><UiButton class="mt-3" @click="refresh">Reintentar</UiButton></div><template v-else-if="data?.policy"><p class="mt-4 text-body-s text-ink-2">Versión {{ data.policy.version }} · Publicada <time :datetime="data.policy.publishedAt">{{ data.policy.publishedAt.slice(0, 10) }}</time></p><div class="mt-6 whitespace-pre-line">{{ data.policy.content }}</div></template><p v-else class="mt-6 text-ink-2">El contenido de esta política está pendiente de aprobación y publicación.</p><div class="mt-6 flex flex-wrap gap-4"><NuxtLink to="/contacto" class="inline-flex min-h-11 items-center text-accent-text underline">Contacto</NuxtLink><NuxtLink to="/catalogo" class="inline-flex min-h-11 items-center text-accent-text underline">Volver al catálogo</NuxtLink></div></section></template>
