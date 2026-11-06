<script setup>
const page = ref(1), searchInput = ref(''), sourceInput = ref('')
const q = ref(''), source = ref('')
const { data, status, error, refresh } = await useFetch('/api/admin/audit', { query: { page, q, source } })
const sources = { audit: 'Auditoría general', inventory: 'Inventario', orders: 'Pedidos' }
const entities = { Product: 'Producto', ProductVariant: 'Variante', Category: 'Categoría', Brand: 'Marca', InventoryLot: 'Lote', Warehouse: 'Almacén', User: 'Usuario', Order: 'Pedido', Coupon: 'Cupón', ContentPage: 'Política', PackageType: 'Caja de envío', RETURN: 'Devolución', PRICE_MATCH: 'Igualación de precio' }
const actions = {
  CREATE_DRAFT_PRODUCT: 'Alta de producto en borrador', UPDATE_PRODUCT: 'Cambio de producto', REACTIVATE_PRODUCT: 'Reactivación de producto',
  UPDATE_VARIANT: 'Cambio de variante', CREATE_CATEGORY: 'Alta de categoría', CREATE_LOT: 'Alta de lote',
  CONFIGURE_WAREHOUSE: 'Alta de almacén', UPDATE_WAREHOUSE: 'Cambio de almacén', REGISTER_ADMINISTRATOR: 'Alta de administrador',
  DEACTIVATE_USER: 'Desactivación de usuario', CREATE_COUPON: 'Alta de cupón', UPDATE_COUPON: 'Cambio de cupón',
  ADJUSTMENT: 'Ajuste de existencias', RETURN_SELLABLE: 'Devolución apta para venta', RETURN_NON_SELLABLE: 'Devolución no vendible',
  REVIEW_CLAIM: 'Revisión de reclamación', RESOLVE_CLAIM: 'Resolución de reclamación',
  CREATE_PACKAGE: 'Alta de caja de envío', UPDATE_PACKAGE: 'Cambio de caja de envío', PUBLISH_POLICY: 'Publicación de política',
  UPDATE_LOT_TRACEABILITY: 'Cambio de trazabilidad de lote', UPDATE_PRODUCT_DETAILS: 'Cambio de detalles de producto',
  CREATE_BRAND: 'Alta de marca', CREATE_VARIANT: 'Alta de variante', UPLOAD_PRODUCT_IMAGE: 'Carga de imagen de producto'
}
const orderStatuses = { PENDING_PAYMENT: 'Pendiente de pago', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado', INICIO: 'Inicio' }
const actionLabel = entry => entry.source === 'orders' ? `Cambio de estado: ${entry.action.split(' → ').map(value => orderStatuses[value] || value).join(' → ')}` : actions[entry.action] || entry.action
const date = value => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'America/Mexico_City' }).format(new Date(value))
function search() { page.value = 1; q.value = searchInput.value.trim(); source.value = sourceInput.value; refresh() }
</script>

<template>
  <div>
    <h2 class="text-display-m font-bold">Registro de acciones</h2>
    <p class="mt-3 text-ink-2">Consulta las altas y los cambios registrados, con su motivo y responsable. Incluye auditoría general, movimientos administrativos de inventario y cambios administrativos de estado de pedidos.</p>
    <UiForm role="search" aria-label="Buscar en el registro de acciones" class="my-6 flex flex-wrap items-end gap-3" @submit.prevent="search">
      <div class="min-w-0 flex-1 basis-64"><UiField id="audit-search" v-model="searchInput" label="Buscar por motivo, responsable, acción o identificador" type="search" maxlength="120" /></div>
      <div><label for="audit-source" class="mb-2 block text-body-s font-semibold">Historial</label><select id="audit-source" v-model="sourceInput" class="min-h-11 rounded-sm border border-border bg-surface p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"><option value="">Todos</option><option v-for="(label, value) in sources" :key="value" :value="value">{{ label }}</option></select></div>
      <UiButton type="submit" :disabled="status === 'pending'">Buscar</UiButton>
      <UiButton variant="secondary" :disabled="status === 'pending'" @click="refresh()">Actualizar</UiButton>
    </UiForm>
    <UiLoading v-if="status === 'pending'" label="Cargando registro de acciones" />
    <div v-else-if="error" role="alert"><p>No se pudo consultar el registro de acciones.</p><UiButton @click="refresh()">Reintentar</UiButton></div>
    <template v-else>
      <p class="text-body-s text-ink-2" role="status">{{ data?.total ?? 0 }} registros · Fechas de Ciudad de México.</p>
      <p v-if="!data?.events.length" class="my-6">No hay registros para esta consulta.</p>
      <ul class="mt-4 grid gap-4">
        <li v-for="entry in data?.events" :key="`${entry.source}:${entry.id}`" class="min-w-0 rounded-sm border border-border bg-surface p-4">
          <div class="flex flex-wrap items-start justify-between gap-2"><h3 class="font-semibold break-words">{{ actionLabel(entry) }}</h3><time :datetime="entry.createdAt" class="text-body-s text-ink-2">{{ date(entry.createdAt) }}</time></div>
          <p class="mt-1 text-body-s text-ink-2">{{ sources[entry.source] }} · {{ entities[entry.entityType] || entry.entityType }}</p>
          <p class="mt-3 break-words"><strong>Motivo:</strong> <span class="whitespace-pre-wrap">{{ entry.reason || 'Sin motivo registrado' }}</span></p>
          <p class="mt-2 break-words"><strong>Responsable:</strong> {{ entry.actorName || (entry.actorType === 'SYSTEM' ? 'Sistema' : 'Responsable no disponible') }}<span v-if="entry.actorEmail"> · {{ entry.actorEmail }}</span></p>
          <details class="mt-3 text-body-s text-ink-2"><summary class="min-h-11 cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">Identificadores del registro</summary><p class="break-all">Entidad: {{ entry.entityId }}</p><p class="break-all">Registro: {{ entry.id }}</p><p v-if="entry.actorId" class="break-all">Responsable: {{ entry.actorId }}</p><p class="break-all">Acción: {{ entry.action }}</p></details>
        </li>
      </ul>
      <nav aria-label="Páginas del registro de acciones" class="my-4 flex flex-wrap items-center gap-4"><UiButton variant="secondary" :disabled="page <= 1" @click="page--">Anterior</UiButton><span>Página {{ data?.page ?? page }} de {{ data?.pages ?? 1 }}</span><UiButton variant="secondary" :disabled="page >= (data?.pages ?? 1)" @click="page++">Siguiente</UiButton></nav>
    </template>
  </div>
</template>
