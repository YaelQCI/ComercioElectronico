<script setup>
import ProductsAdministration from './ProductsAdministration.vue'
import InventoryAdministration from './InventoryAdministration.vue'
import UsersAdministration from './UsersAdministration.vue'
import OrdersAdministration from './OrdersAdministration.vue'
import PolicyAdministration from '../policies/PolicyAdministration.vue'
const { data, status, error, refresh } = await useFetch('/api/account/session', { key: 'account-session' })
const section = ref('products')
const sections = [{ value: 'products', label: 'Productos' }, { value: 'inventory', label: 'Inventario' }, { value: 'users', label: 'Usuarios' }, { value: 'orders', label: 'Pedidos' }, { value: 'policies', label: 'Políticas' }]
useHead({ title: 'Administración · The Fitness Stuff', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-12 md:px-8">
    <UiBreadcrumbs :items="[{ label: 'Mi cuenta', to: '/cuenta' }, { label: 'Administración' }]" />
    <h1 class="text-display-l font-bold">Administración</h1>
    <UiLoading v-if="status === 'pending'" label="Comprobando acceso" />
    <div v-else-if="error" role="alert"><p>No pudimos comprobar tu sesión.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <div v-else-if="!data?.user" class="mt-6"><p>Inicia sesión con tu cuenta de administrador.</p><UiButton to="/cuenta" class="mt-4">Iniciar sesión</UiButton></div>
    <p v-else-if="data.user.role !== 'ADMIN'" role="alert" class="mt-6">Tu cuenta no tiene permisos de administración.</p>
    <template v-else>
      <p class="mt-3 text-ink-2">Gestiona la tienda. Cada modificación requiere un motivo y conserva el historial.</p>
      <nav aria-label="Administración de la tienda" class="my-6 flex flex-wrap gap-3">
        <UiButton v-for="item in sections" :key="item.value" :variant="section === item.value ? 'primary' : 'secondary'" :aria-pressed="section === item.value" @click="section = item.value">{{ item.label }}</UiButton>
      </nav>
      <ProductsAdministration v-if="section === 'products'" />
      <InventoryAdministration v-else-if="section === 'inventory'" />
      <UsersAdministration v-else-if="section === 'users'" :current-user-id="data.user.id" />
      <OrdersAdministration v-else-if="section === 'orders'" />
      <PolicyAdministration v-else />
    </template>
  </section>
</template>
