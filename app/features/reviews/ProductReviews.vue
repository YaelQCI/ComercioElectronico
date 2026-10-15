<script setup>
const props = defineProps({ productId: { type: String, required: true } })
const page = ref(1), busy = ref(false), failure = ref(''), message = useConfirmationMessage(), rating = ref('5'), title = ref(''), body = ref('')
const { data, error, status, refresh } = await useFetch(() => `/api/reviews/products/${props.productId}`, { query: { page } })
async function editMine() {
  failure.value = ''
  try { const result = await $fetch(`/api/reviews/products/${props.productId}/mine`); if (result.review) { rating.value = String(result.review.rating); title.value = result.review.title ?? ''; body.value = result.review.body; message.value = result.review.hiddenAt ? 'Reseña oculta por moderación; editarla no vuelve a publicarla.' : 'Tu reseña está lista para editar.' } else message.value = 'Aún no has publicado una reseña.' }
  catch (e) { failure.value = e.data?.statusMessage ?? 'Inicia sesión para consultar tu reseña.' }
}
async function publish() {
  if (busy.value) return
  busy.value = true; failure.value = ''; message.value = ''
  try { const result = await $fetch(`/api/reviews/products/${props.productId}`, { method: 'POST', body: { rating: Number(rating.value), title: title.value, body: body.value } }); message.value = result.hidden ? 'Reseña guardada; permanece oculta por moderación.' : 'Reseña guardada.'; await refresh() }
  catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos guardar la reseña.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="mt-10" aria-label="Reseñas verificadas"><h2 class="text-display-m font-bold">Reseñas verificadas</h2>
    <UiLoading v-if="status === 'pending'" label="Cargando reseñas" />
    <div v-else-if="error" role="alert"><p>Reseñas no disponibles.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else-if="data"><p v-if="!data.total" class="mt-3">Este producto aún no tiene reseñas.</p><template v-else><p class="mt-3">{{ data.average.toFixed(1) }} de 5 · {{ data.total }} reseñas</p><ul class="mt-3 flex flex-wrap gap-4" aria-label="Distribución de calificaciones"><li v-for="n in [5,4,3,2,1]" :key="n">{{ n }} estrellas: {{ data.distribution[n] }}</li></ul></template>
      <ul class="mt-6 grid gap-4"><li v-for="review in data.reviews" :key="review.id" class="rounded-sm border border-line bg-surface p-4"><p class="font-semibold">{{ review.author }} · {{ review.rating }} de 5</p><p class="text-body-s text-ok">Compra verificada</p><time :datetime="review.createdAt" class="text-body-s">{{ review.createdAt.slice(0, 10) }}</time><h3 v-if="review.title" class="mt-3 font-semibold">{{ review.title }}</h3><p class="mt-2 whitespace-pre-line">{{ review.body }}</p><p v-if="review.editedAt" class="text-body-s text-ink-2">Editada {{ review.editedAt.slice(0, 10) }}</p></li></ul>
      <nav v-if="data.pages > 1" aria-label="Páginas de reseñas" class="mt-4 flex gap-4"><UiButton :disabled="page <= 1" @click="page--">Anterior</UiButton><span>{{ page }} / {{ data.pages }}</span><UiButton :disabled="page >= data.pages" @click="page++">Siguiente</UiButton></nav>
    </template>
    <details class="mt-6"><summary class="min-h-11 cursor-pointer">Publicar o editar mi reseña</summary><p class="mt-3">Necesitas una cuenta con un pedido entregado de este producto. Las presentaciones comparten reseñas.</p><NuxtLink to="/cuenta" class="inline-flex min-h-11 items-center text-accent-text underline">Ir a mi cuenta</NuxtLink><UiButton variant="secondary" :disabled="busy" @click="editMine">Cargar mi reseña</UiButton>
      <form class="mt-4 grid max-w-xl gap-4" @submit.prevent="publish"><UiField id="review-rating" v-model="rating" label="Calificación" :options="[1,2,3,4,5].map(n => ({ value: String(n), label: `${n} de 5` }))" /><UiField id="review-title" v-model="title" label="Título (opcional)" maxlength="120" /><div><label for="review-body" class="mb-2 block font-semibold">Tu reseña</label><textarea id="review-body" v-model="body" required maxlength="4000" rows="5" class="w-full rounded-sm border border-border bg-surface p-3 text-ink" /></div><UiButton type="submit" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar reseña' }}</UiButton></form>
    </details><p v-if="failure" role="alert" class="mt-3 text-crit">{{ failure }}</p>
  </section>
</template>
