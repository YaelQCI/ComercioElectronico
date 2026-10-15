<script setup>
const { data: session } = await useFetch('/api/account/session', { key: 'account-session' })
useHead(() => ({ htmlAttrs: { 'data-theme': session.value?.user?.themePreference ?? 'system' } }))
</script>
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UiToasts />
</template>
