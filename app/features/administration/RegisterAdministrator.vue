<script setup>
import { useAdministration } from './useAdministration.js'
const open = ref(false)
const emptyForm = () => ({ displayName: '', email: '', password: '', passwordConfirmation: '', reason: '' })
const form = reactive(emptyForm())
const { busy, failure, save } = useAdministration(() => refreshNuxtData('administration-users'))
function close() {
  if (busy.value) return
  open.value = false
  Object.assign(form, emptyForm())
  failure.value = ''
}
async function register() {
  if (await save('/api/admin/users', { ...form })) {
    close()
  }
}
</script>
<template>
  <div>
    <UiButton @click="open = true">Registrar administrador</UiButton>
    <UiModal :open="open" title="Registrar nuevo administrador" :busy="busy" @close="close">
      <p class="mb-5 text-ink-2">Esta cuenta tendrá acceso a la administración de la tienda. Para ingresar, deberá usar el correo y la contraseña que registres aquí.</p>
      <form class="grid gap-4" :aria-busy="busy" @submit.prevent="register">
        <UiField id="admin-name" v-model="form.displayName" label="Nombre completo" autocomplete="name" required maxlength="120" :disabled="busy" />
        <UiField id="admin-email" v-model="form.email" label="Correo electrónico" type="email" autocomplete="off" required maxlength="254" :disabled="busy" />
        <UiField id="admin-password" v-model="form.password" label="Contraseña" type="password" password-toggle autocomplete="new-password" hint="Al menos 12 caracteres y hasta 256 bytes." required minlength="12" :disabled="busy" />
        <UiField id="admin-password-confirmation" v-model="form.passwordConfirmation" label="Confirmar contraseña" type="password" password-toggle autocomplete="new-password" required minlength="12" :disabled="busy" />
        <UiField id="admin-registration-reason" v-model="form.reason" label="Motivo del registro" required maxlength="500" :disabled="busy" />
        <p v-if="failure" role="alert" class="text-crit">{{ failure }}</p>
        <div class="flex flex-wrap justify-end gap-3">
          <UiButton variant="secondary" :disabled="busy" @click="close">Cancelar</UiButton>
          <UiButton type="submit" :disabled="busy">{{ busy ? 'Registrando…' : 'Crear administrador' }}</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>
