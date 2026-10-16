<template>
  <section class="mx-auto min-h-[60vh] max-w-store px-4 py-8 md:px-8" data-page-loading>
    <div aria-hidden="true" class="mb-8 space-y-4 motion-safe:animate-pulse"><div class="h-4 w-36 bg-surface-2" /><div class="h-9 w-1/2 max-w-sm bg-surface-2" /></div>
    <UiLoading label="Cargando página…" :cards="3" />
  </section>
</template>
