<script setup>
const { toasts, dismiss } = useToasts()
const target = shallowRef(null)
let observer
onMounted(() => {
  function locate() {
    const dialogs = [...document.querySelectorAll('dialog[open]')]
    target.value = dialogs.at(-1) ?? document.body
  }
  observer = new MutationObserver(locate)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
  locate()
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <Teleport v-if="target" :to="target">
    <div aria-label="Confirmaciones" aria-live="polite" aria-atomic="false" class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-3">
      <UiToast v-for="toast in toasts" :key="toast.id" :text="toast.text" @dismiss="dismiss(toast.id)" />
    </div>
  </Teleport>
</template>
