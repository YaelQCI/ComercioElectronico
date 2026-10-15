<script setup>
import { useAdministration } from './useAdministration.js'
defineProps({ currentUserId: { type: String, required: true } })
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/users', { query: { page } })
const { busy, failure, message, save } = useAdministration(refresh)
const selected = ref(null), reason = ref('')
async function deactivate() {
  if (await save(`/api/admin/users/${selected.value.id}/deactivate`, { reason: reason.value })) { selected.value = null; reason.value = '' }
}
</script>
<template>
  <div>
    <h2 class="text-display-m font-bold">Usuarios</h2><p class="mt-3 text-ink-2">La desactivación cierra sus sesiones y conserva el historial de compras.</p>
    <p v-if="failure" role="alert" class="my-4 text-crit">{{ failure }}</p>
    <UiLoading v-if="status === 'pending'" label="Cargando usuarios" />
    <div v-else-if="error" role="alert"><p>No se pudieron cargar los usuarios.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else>
      <p v-if="!data?.users.length" class="my-6">No hay usuarios en esta página.</p>
      <ul class="mt-6 grid gap-4"><li v-for="user in data?.users" :key="user.id" class="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-surface p-4"><div><h3 class="font-semibold">{{ user.displayName }}</h3><p class="break-all">{{ user.email }}</p><p class="text-body-s text-ink-2">{{ user.role === 'ADMIN' ? 'Administrador' : 'Cliente' }} · {{ user.deletedAt ? 'Desactivado' : 'Activo' }}{{ user.id === currentUserId ? ' · Tu cuenta' : '' }}</p></div><UiButton v-if="user.role !== 'ADMIN' && !user.deletedAt" variant="secondary" :disabled="busy" @click="selected = user; reason = ''">Desactivar usuario</UiButton></li></ul>
      <nav aria-label="Páginas de usuarios" class="my-4 flex items-center gap-4"><UiButton variant="secondary" :disabled="page <= 1 || busy" @click="page--">Anterior</UiButton><span>Página {{ page }}</span><UiButton variant="secondary" :disabled="(data?.users.length || 0) < 20 || busy" @click="page++">Siguiente</UiButton></nav>
      <UiModal :open="!!selected" title="Desactivar usuario" :busy="busy" @close="selected = null"><p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
      <form class="mt-6 grid gap-4 rounded-sm border border-border p-4" @submit.prevent="deactivate"><h3 class="font-semibold">Desactivar {{ selected.email }}</h3><p>Confirma la desactivación de esta cuenta. Sus sesiones dejarán de ser válidas.</p><UiField id="user-reason" v-model="reason" label="Motivo de la desactivación" required maxlength="500" /><div class="flex gap-3"><UiButton type="submit" :disabled="busy">Confirmar desactivación</UiButton><UiButton variant="secondary" :disabled="busy" @click="selected = null">Cancelar</UiButton></div></form></UiModal>
    </template>
  </div>
</template>
