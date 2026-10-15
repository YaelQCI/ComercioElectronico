<script setup>
import LoyaltyBalance from '~/features/loyalty/LoyaltyBalance.vue'
import ThemeControl from '~/features/appearance/ThemeControl.vue'
import AddressModal from './AddressModal.vue'
import { passwordConfirmationError } from '~~/shared/features/accounts/registration.js'
const { data, error, status, refresh } = await useFetch('/api/account/session', { key: 'account-session' })
const mode = ref('login'), busy = ref(false), failure = ref(''), message = useConfirmationMessage()
const email = ref(''), password = ref(''), displayName = ref(''), phone = ref(''), currentPassword = ref(''), newPassword = ref('')
const profile = ref(null)
const passwordConfirmation = ref(''), confirmationTouched = ref(false)
const confirmationError = computed(() => mode.value === 'register' && confirmationTouched.value ? passwordConfirmationError(password.value, passwordConfirmation.value) : '')
watch(mode, () => { passwordConfirmation.value = ''; confirmationTouched.value = false; failure.value = '' })
watch([password, passwordConfirmation], () => {
  if (['Confirma tu contraseña.', 'Las contraseñas no coinciden.'].includes(failure.value)) failure.value = ''
})
async function submitAccount() {
  if (mode.value === 'register') {
    confirmationTouched.value = true
    if (confirmationError.value) {
      failure.value = confirmationError.value
      document.getElementById('account-password-confirmation')?.focus()
      return
    }
  }
  await perform(mode.value, { email: email.value, password: password.value, displayName: displayName.value, ...(mode.value === 'register' ? { passwordConfirmation: passwordConfirmation.value } : {}) })
}
async function addressSaved() {
  failure.value = ''
  message.value = 'Dirección guardada.'
  await loadProfile()
}
async function perform(action, body = {}) {
  if (busy.value) return
  busy.value = true; failure.value = ''; message.value = ''
  try {
    const result = await $fetch(`/api/account/${action}`, { method: action === 'profile' ? 'PATCH' : 'POST', body })
    password.value = ''; passwordConfirmation.value = ''; confirmationTouched.value = false; currentPassword.value = ''; newPassword.value = ''
    if (result.user) { displayName.value = result.user.displayName; phone.value = result.user.phone ?? '' }
    await refresh(); await loadProfile()
    message.value = action === 'logout' ? 'Sesión cerrada.' : action === 'password' ? 'Contraseña cambiada. Inicia sesión de nuevo.' : action === 'deactivate' ? 'Cuenta desactivada; el historial se conserva.' : 'Cambios guardados.'
  } catch (e) { failure.value = e.data?.statusMessage ?? 'No pudimos completar la operación.' }
  finally { busy.value = false }
}
async function loadProfile() {
  profile.value = null
  if (!data.value?.user) return
  try { profile.value = await $fetch('/api/account/profile'); displayName.value = profile.value.user.displayName; phone.value = profile.value.user.phone ?? '' }
  catch (e) { failure.value = e.data?.statusMessage ?? 'Perfil no disponible.' }
}
onMounted(loadProfile)
watch(() => data.value?.user?.id, (id, previous) => { if (id !== previous) loadProfile() })
</script>
<template>
  <section class="mx-auto max-w-store px-4 py-12 md:px-8">
    <UiBreadcrumbs :items="[{ label: 'Mi cuenta' }]" /><h1 class="text-display-l font-bold">Mi cuenta</h1>
    <UiLoading v-if="status === 'pending'" label="Consultando sesión" />
    <div v-if="error" role="alert"><p>Cuenta no disponible.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <p v-if="failure" role="alert" class="mt-4 text-crit">{{ failure }}</p>
    <template v-if="!error && status !== 'pending'">
      <div v-if="!data?.user" class="mt-6 max-w-xl">
        <div class="flex flex-wrap gap-3"><UiButton variant="secondary" :aria-pressed="mode === 'login'" @click="mode = 'login'">Iniciar sesión</UiButton><UiButton variant="secondary" :aria-pressed="mode === 'register'" @click="mode = 'register'">Crear cuenta</UiButton></div>
        <form class="mt-6 grid gap-4" @submit.prevent="submitAccount">
          <UiField v-if="mode === 'register'" id="account-name" v-model="displayName" label="Nombre" required maxlength="120" autocomplete="name" />
          <UiField id="account-email" v-model="email" label="Correo" type="email" required maxlength="254" autocomplete="username" />
          <UiField id="account-password" v-model="password" label="Contraseña" type="password" password-toggle required :minlength="mode === 'register' ? 12 : undefined" maxlength="256" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" :hint="mode === 'register' ? 'Al menos 12 caracteres.' : undefined" />
          <UiField v-if="mode === 'register'" id="account-password-confirmation" v-model="passwordConfirmation" label="Confirmar contraseña" type="password" password-toggle required maxlength="256" autocomplete="new-password" :error="confirmationError" @blur="confirmationTouched = true" />
          <UiButton type="submit" :disabled="busy">{{ busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Registrarme' }}</UiButton>
        </form>
        <UiButton variant="secondary" class="mt-4" :disabled="busy" @click="perform('refresh')">Renovar mi sesión</UiButton>
        <p class="mt-4 text-ink-2">La recuperación por correo y la verificación de compras invitadas están pendientes de habilitar.</p>
      </div>
      <div v-else class="mt-6 grid gap-8 lg:grid-cols-2">
        <div><p>{{ data.user.email }}</p><UiButton v-if="data.user.role === 'ADMIN'" to="/admin" class="mt-4 mr-3">Panel de administración</UiButton><UiButton class="mt-4" variant="secondary" :disabled="busy" @click="perform('logout')">Cerrar sesión</UiButton>
          <form class="mt-6 grid gap-4" @submit.prevent="perform('profile', { displayName, phone })"><UiField id="profile-name" v-model="displayName" label="Nombre" required maxlength="120" /><UiField id="profile-phone" v-model="phone" label="Teléfono" type="tel" maxlength="25" /><UiButton type="submit" :disabled="busy">Guardar perfil</UiButton></form>
          <ThemeControl :preference="data.user.themePreference" :refresh-session="refresh" />
          <h2 class="mt-8 text-display-m font-bold">Cambiar contraseña</h2>
          <form class="mt-4 grid gap-4" @submit.prevent="perform('password', { currentPassword, password: newPassword })"><UiField id="current-password" v-model="currentPassword" label="Contraseña actual" type="password" required autocomplete="current-password" /><UiField id="new-password" v-model="newPassword" label="Nueva contraseña" type="password" required minlength="12" maxlength="256" autocomplete="new-password" /><UiButton type="submit" :disabled="busy">Cambiar y cerrar sesiones</UiButton></form>
          <details class="mt-8"><summary class="min-h-11 cursor-pointer">Desactivar mi cuenta</summary><p class="mt-3">Se cerrarán las sesiones y se conservará el historial comercial. Esta acción no equivale a una solicitud de eliminación de datos.</p><form class="mt-3 grid gap-4" @submit.prevent="perform('deactivate', { currentPassword })"><UiField id="deactivate-password" v-model="currentPassword" label="Confirma tu contraseña" type="password" required autocomplete="current-password" /><UiButton type="submit" variant="secondary" :disabled="busy">Desactivar cuenta</UiButton></form></details>
        </div>
        <div><h2 class="text-display-m font-bold">Direcciones</h2><p v-if="!profile?.addresses.length" class="mt-3">Aún no hay direcciones guardadas.</p>
          <ul class="mt-4 grid gap-4"><li v-for="item in profile?.addresses" :key="item.id" class="rounded-sm border border-line p-4"><p>{{ item.recipientName }} · {{ item.label }}</p><p>{{ item.street }} {{ item.exteriorNumber }}, {{ item.district }}, {{ item.city }}, {{ item.state }} · {{ item.postalCode }}</p><p v-if="item.isDefault">Predeterminada</p><UiButton v-else class="mt-2" variant="secondary" :disabled="busy" @click="perform('addresses', { ...item, isDefault: true })">Usar como predeterminada</UiButton></li></ul>
          <div class="mt-6 flex flex-wrap items-center gap-4">
            <AddressModal @saved="addressSaved" />
            <NuxtLink to="/pedidos" class="inline-flex min-h-11 items-center text-accent-text underline">Consultar mis pedidos</NuxtLink>
          </div>
          <LoyaltyBalance />
        </div>
      </div>
    </template>
  </section>
</template>
