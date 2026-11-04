<script setup>
defineProps({ product: Object, requirements: { type: Array, default: () => [] } })
const open = ref(false)
</script>

<template>
  <UiButton class="fixed bottom-4 right-4 z-20 max-w-[calc(100vw-2rem)] shadow-lg" aria-haspopup="dialog" :aria-expanded="open" @click="open = !open">¿Cómo publicar un producto?</UiButton>
  <Teleport to="body">
  <UiModal :open="open" title="Cómo publicar un producto" @close="open = false" @keydown.esc.prevent.stop="open = false">
    <template v-if="product">
      <p class="mb-3 font-semibold">{{ product.name }}</p>
      <p v-if="product.published && !product.deactivated" class="mb-3 text-body-s">Este producto ya está publicado.</p>
      <ul class="list-disc space-y-3 pl-5 text-body-s">
        <li v-for="requirement in requirements" :key="requirement.key">
          <span class="sr-only">{{ requirement.complete ? 'Completado:' : 'Pendiente:' }}</span>
          <span :class="{ 'line-through text-ink-2': requirement.complete }">{{ requirement.instruction }}</span>
        </li>
      </ul>
      <p v-if="!product.published || product.deactivated" class="mt-4 text-body-s" role="status">{{ requirements.some(requirement => !requirement.complete) ? 'Completa los requisitos pendientes para habilitar Publicar.' : 'Los requisitos están completos. Revisa los campos obligatorios y sus formatos antes de publicar.' }}</p>
    </template>
    <template v-else>
      <p class="mb-3">El borrador todavía no es visible en el catálogo. Para publicarlo:</p>
      <ol class="list-decimal space-y-3 pl-5 text-body-s">
        <li>Completa los campos obligatorios y crea el borrador.</li>
        <li>Abre Gestionar en el producto que quieres publicar.</li>
        <li>En Imágenes, agrega y guarda una imagen de tipo Imagen frontal.</li>
        <li>Mantén el producto activo y al menos una variante activa. Puedes agregar otra con Agregar presentación.</li>
        <li>Escribe el Motivo de los cambios; es independiente del motivo de la carga de imágenes.</li>
      </ol>
    </template>
    <p class="mt-4 text-body-s">Al terminar, cierra esta ayuda y pulsa Publicar en Estado en el catálogo, debajo del formulario. Publicar también guarda los cambios; Guardar cambios conserva el estado de publicación actual.</p>
    <UiButton class="mt-5" variant="secondary" @click="open = false">Cerrar ayuda</UiButton>
  </UiModal>
  </Teleport>
</template>
