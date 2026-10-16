<script setup>
import { observeInterfaceErrors } from '~/features/notifications/interface-errors.js'
const { error: notify } = useToasts()
const nuxtApp = useNuxtApp()
let stop
const unexpected = () => notify('Ocurrió un error inesperado. Vuelve a intentarlo o recarga la página.')
const stopVue = nuxtApp.hook('vue:error', unexpected)
const stopApp = nuxtApp.hook('app:error', unexpected)
onMounted(() => { stop = observeInterfaceErrors(document, notify) })
onBeforeUnmount(() => { stop?.(); stopVue(); stopApp() })
</script>
<template><span hidden aria-hidden="true" /></template>
