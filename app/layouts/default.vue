<template>
  <div class="flex min-h-screen flex-col">
    <a href="#contenido" class="sr-only z-50 rounded-sm bg-accent px-4 py-3 text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Saltar al contenido</a>
    <SiteHeader />
    <main id="contenido" tabindex="-1" class="min-w-0 flex-1 scroll-mt-44"><slot /></main>
    <SiteFooter />
  </div>
</template>
