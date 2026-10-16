<script setup>
import ReviewStars from './ReviewStars.vue'
import ReviewRatingPicker from './ReviewRatingPicker.vue'
const props = defineProps({ productId: { type: String, required: true } })
const page = ref(1), busy = ref(false), failure = ref(''), message = useConfirmationMessage(), rating = ref('5'), title = ref(''), body = ref('')
const loadingMine = ref(false)
const { data, error, status, refresh } = await useFetch(() => `/api/reviews/products/${props.productId}`, { query: { page } })
const percentage = stars => data.value?.total ? Math.round((data.value.distribution[stars] ?? 0) / data.value.total * 100) : 0
async function editMine() {
  if (busy.value || loadingMine.value) return
  loadingMine.value = true
  failure.value = ''
  try { const result = await $fetch(`/api/reviews/products/${props.productId}/mine`); if (result.review) { rating.value = String(result.review.rating); title.value = result.review.title ?? ''; body.value = result.review.body; message.value = result.review.hiddenAt ? 'Reseña oculta por moderación; editarla no vuelve a publicarla.' : 'Tu reseña está lista para editar.' } else message.value = 'Aún no has publicado una reseña.' }
  catch (e) { failure.value = e.data?.statusMessage ?? 'Inicia sesión para consultar tu reseña.' }
  finally { loadingMine.value = false }
}
async function publish() {
  if (busy.value || loadingMine.value) return
  busy.value = true; failure.value = ''; message.value = ''
  try { const result = await $fetch(`/api/reviews/products/${props.productId}`, { method: 'POST', body: { rating: Number(rating.value), title: title.value, body: body.value } }); message.value = result.hidden ? 'Reseña guardada; permanece oculta por moderación.' : 'Reseña guardada.'; await refresh() }
  catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos guardar la reseña.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="mt-16" aria-label="Reseñas verificadas"><h2 class="font-display text-display-l font-bold uppercase">Reseñas</h2>
    <UiLoading variant="list" v-if="status === 'pending'" label="Cargando reseñas" />
    <div v-else-if="error" role="alert"><p>Reseñas no disponibles.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else-if="data">
      <div class="mt-6 grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div>
        <div>
          <template v-if="data.total"><p class="mb-2 flex items-baseline gap-2"><strong class="text-display-l">{{ data.average.toFixed(1) }}</strong><span class="text-ink-2">de 5</span></p><ReviewStars :rating="data.average" /><p class="mt-2 text-body-s text-ink-2">{{ data.total }} {{ data.total === 1 ? 'reseña verificada' : 'reseñas verificadas' }}</p></template>
          <template v-else><p class="font-semibold">Este producto aún no tiene reseñas.</p><p class="mt-2 text-body-s text-ink-2">Comparte tu experiencia después de recibir tu compra.</p></template>
          <details class="mt-4 text-body-s"><summary class="min-h-11 cursor-pointer py-2 text-accent-text">¿Cómo funcionan las reseñas?</summary><p class="mt-2 text-ink-2">Solo pueden reseñar quienes tienen una compra entregada de este producto. El promedio y los porcentajes se calculan con las reseñas visibles de todas sus presentaciones.</p></details>
        </div>
        <ul class="mt-4 grid content-start gap-3" aria-label="Distribución de calificaciones">
          <li v-for="n in [5,4,3,2,1]" :key="n" class="grid grid-cols-[5rem_minmax(0,1fr)_3rem] items-center gap-3 text-body-s" :aria-label="`${n} estrellas: ${data.distribution[n] ?? 0} reseñas, ${percentage(n)} por ciento`">
            <span>{{ n }} {{ n === 1 ? 'estrella' : 'estrellas' }}</span>
            <span class="h-4 overflow-hidden rounded-sm border border-border bg-surface-2" aria-hidden="true"><span class="block h-full bg-accent" :style="{ width: `${percentage(n)}%` }" /></span>
            <span class="text-right tabular-nums">{{ percentage(n) }}%</span>
          </li>
        </ul>
        </div>
        <ul class="grid min-w-0 gap-4"><li v-for="review in data.reviews" :key="review.id" class="rounded-sm border border-line bg-surface p-4 md:p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div class="flex flex-wrap items-center gap-3"><p class="font-display text-display-m font-bold uppercase">{{ review.author }}</p><span class="rounded-sm bg-accent-soft px-2 py-1 font-mono text-label uppercase tracking-wide text-accent-text">Compra verificada</span></div><time :datetime="review.createdAt" class="font-mono text-label text-ink-2">{{ review.createdAt.slice(0, 10) }}</time></div><div class="mt-2"><ReviewStars :rating="review.rating" /></div><h3 v-if="review.title" class="mt-3 font-semibold">{{ review.title }}</h3><p class="mt-2 whitespace-pre-line break-words text-body-s text-ink-2">{{ review.body }}</p><p v-if="review.editedAt" class="mt-2 text-label text-ink-2">Editada {{ review.editedAt.slice(0, 10) }}</p></li></ul>
      </div>
      <nav v-if="data.pages > 1" aria-label="Páginas de reseñas" class="mt-4 flex gap-4"><UiButton :disabled="page <= 1" @click="page--">Anterior</UiButton><span>{{ page }} / {{ data.pages }}</span><UiButton :disabled="page >= data.pages" @click="page++">Siguiente</UiButton></nav>
    </template>
    <details class="mt-6"><summary class="min-h-11 cursor-pointer">Publicar o editar mi reseña</summary><p class="mt-3">Necesitas una cuenta con un pedido entregado de este producto. Las presentaciones comparten reseñas.</p>
      <div class="my-4 flex flex-wrap items-center gap-3">
        <UiButton to="/cuenta" variant="secondary">Ir a mi cuenta</UiButton>
        <UiButton variant="secondary" :disabled="busy || loadingMine" :aria-busy="loadingMine" aria-describedby="recover-review-help" @click="editMine">{{ loadingMine ? 'Recuperando reseña…' : 'Recuperar mi reseña para editar' }}</UiButton>
      </div>
      <p id="recover-review-help" class="text-body-s text-ink-2">Si ya publicaste una reseña, recupérala para llenar este formulario y editarla. Si es tu primera reseña, completa los campos y pulsa Guardar reseña.</p>
      <form class="mt-4 grid max-w-xl gap-4" @submit.prevent="publish"><ReviewRatingPicker v-model="rating" :disabled="busy || loadingMine" /><UiField id="review-title" v-model="title" label="Título (opcional)" maxlength="120" :disabled="busy || loadingMine" /><div><label for="review-body" class="mb-2 block font-semibold">Tu reseña</label><textarea id="review-body" v-model="body" required maxlength="4000" rows="5" :disabled="busy || loadingMine" class="w-full rounded-sm border border-border bg-surface p-3 text-ink" /></div><UiButton type="submit" :disabled="busy || loadingMine">{{ busy ? 'Guardando…' : 'Guardar reseña' }}</UiButton></form>
    </details><p v-if="failure" role="alert" class="mt-3 text-crit">{{ failure }}</p>
  </section>
</template>
