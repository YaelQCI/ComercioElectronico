<script setup>
import { pesosToCents, centsToPesos } from './price-input.js'
import { useAdministration } from './useAdministration.js'
import { useDraftIdentifiers } from './useDraftIdentifiers.js'
import ProductImages from './ProductImages.vue'
import CategorySelection from './CategorySelection.vue'
import CategoryManager from './CategoryManager.vue'
import VariantNutritionFields from '../catalog/VariantNutritionFields.vue'
import BrandSelection from '../catalog/BrandSelection.vue'
import ProductRecommendationsFields from '../catalog/ProductRecommendationsFields.vue'
import AddProductVariant from '../catalog/AddProductVariant.vue'
import ProductTextFields from '../catalog/ProductTextFields.vue'
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/catalog', { query: { page } })
const { busy, failure, message, save } = useAdministration(refresh)
const { data: classification, error: classificationError, refresh: refreshCategories } = await useFetch('/api/admin/categories')
const draftCategoryIds = ref([])
const { data: detailOptions, refresh: refreshDetailOptions } = await useFetch('/api/admin/catalog/options')
async function brandCreated(brand) { if (detailOptions.value) detailOptions.value.brands.push(brand); await refreshDetailOptions() }
const draft = reactive({ name: '', slug: '', description: '', reason: '', sku: '', flavor: '', presentationLabel: '', contentAmount: '', contentUnit: '', pricePesos: '', servings: '', weightGrams: '', lengthMm: '', widthMm: '', heightMm: '', ingredients: '', usageInstructions: '', allergenInformation: '', brandId: '', servingAmount: '', servingUnit: '', nutritionRows: [], relatedProductIds: [], crossSellProductIds: [] })
const creating = ref(false), creatingOpen = ref(false)
const { pending: checkingIdentifiers, failure: identifierFailure, slugError, skuError, verify: verifyIdentifiers } = useDraftIdentifiers(draft)
const fields = [{ key: 'sku', label: 'SKU' }, { key: 'flavor', label: 'Sabor' }, { key: 'presentationLabel', label: 'Presentación' }, { key: 'contentAmount', label: 'Contenido (cantidad)' }, { key: 'contentUnit', label: 'Unidad de contenido' }, { key: 'pricePesos', label: 'Precio en pesos (MXN)', hint: 'Ejemplo: 150.00. Hasta dos decimales, sin separadores de miles.', price: true }, { key: 'weightGrams', label: 'Peso en gramos', numeric: true }, { key: 'lengthMm', label: 'Largo en milímetros', numeric: true }, { key: 'widthMm', label: 'Ancho en milímetros', numeric: true }, { key: 'heightMm', label: 'Alto en milímetros', numeric: true }]
const selected = ref(null), edit = reactive({ name: '', slug: '', description: '', reason: '', categoryIds: [] }), variantEdits = ref([]), editForm = ref(null)
const withdrawing = ref(false), withdrawalReason = ref('')
const reactivating = ref(false), reactivationReason = ref('')
async function reactivate() {
  const product = selected.value
  if (await save(`/api/admin/catalog/${product.id}/reactivate`, { expectedUpdatedAt: product.updatedAt, reason: reactivationReason.value })) {
    reactivating.value = false
    const fresh = data.value?.products.find(item => item.id === product.id)
    if (fresh) select(fresh)
  }
}
async function withdraw() {
  const product = selected.value
  if (await save(`/api/admin/catalog/${product.id}`, { published: false, expectedUpdatedAt: product.updatedAt, reason: withdrawalReason.value }, 'PATCH')) {
    withdrawing.value = false
    const fresh = data.value?.products.find(item => item.id === product.id)
    if (fresh) select(fresh)
  }
}
const publicationProblem = computed(() => {
  const product = selected.value
  if (!product) return ''
  if (product.deactivated) return 'Este producto está desactivado y no se puede publicar.'
  if (!product.published && !edit.reason.trim()) return 'Escribe el motivo de los cambios para habilitar Publicar. El motivo de las imágenes es independiente.'
  if (!product.published && !product.images?.some(image => image.kind === 'FRONT')) return 'Agrega y guarda una imagen de tipo Imagen frontal en la sección Imágenes para publicar.'
  if (!product.published && !product.variants.some(variant => !variant.deactivated)) return 'El producto necesita al menos una variante activa para publicarse.'
  return ''
})
function select(product) {
  selected.value = product
  Object.assign(edit, { name: product.name, slug: product.slug, description: product.description, ingredients: product.ingredients ?? '', usageInstructions: product.usageInstructions ?? '', allergenInformation: product.allergenInformation ?? '', brandId: product.brandId ?? '', relatedProductIds: (product.recommendations ?? []).filter(item => item.kind === 'RELATED').map(item => item.id), crossSellProductIds: (product.recommendations ?? []).filter(item => item.kind === 'CROSS_SELL').map(item => item.id), featuredPosition: product.featuredPosition == null ? '' : String(product.featuredPosition), reason: '', categoryIds: product.categories.map(category => category.id) })
  variantEdits.value = product.variants.map(variantDraft)
}
function variantDraft(variant) { return { ...variant, servings: variant.servings ?? '', servingAmount: variant.servingAmount ?? '', servingUnit: variant.servingUnit ?? '', nutritionRows: (variant.nutritionData?.rows ?? []).map(row => ({ ...row })), pricePesos: centsToPesos(variant.priceCents), compareAtPricePesos: centsToPesos(variant.compareAtPriceCents) } }
function variantPayload(variant) { return { servingAmount: variant.servingAmount.trim() || null, servingUnit: variant.servingUnit.trim() || null, nutritionData: variant.nutritionRows.length ? { rows: variant.nutritionRows.map(row => ({ name: row.name, amount: String(row.amount), unit: row.unit })) } : null } }
async function variantCreated() { const productId = selected.value.id; await refresh(); const fresh = data.value?.products.find(item => item.id === productId); if (fresh) { for (const variant of fresh.variants) if (!variantEdits.value.some(item => item.id === variant.id)) variantEdits.value.push(variantDraft(variant)); selected.value = fresh } }
async function create() {
  if (creating.value || busy.value) return
  creating.value = true
  try {
    if (!await verifyIdentifiers(true)) return
    const variant = Object.fromEntries(fields.map(f => [f.price ? 'priceCents' : f.key, f.price ? pesosToCents(draft[f.key]) : f.numeric ? Number(draft[f.key]) : draft[f.key]]))
    variant.servings = draft.servings.trim() || null
    Object.assign(variant, variantPayload(draft))
    if (await save('/api/admin/catalog', { name: draft.name, slug: draft.slug, description: draft.description, reason: draft.reason, ingredients: draft.ingredients, usageInstructions: draft.usageInstructions, allergenInformation: draft.allergenInformation, brandId: draft.brandId || null, relatedProductIds: draft.relatedProductIds, crossSellProductIds: draft.crossSellProductIds, categoryIds: draftCategoryIds.value, variants: [variant] })) {
      for (const key of Object.keys(draft)) draft[key] = Array.isArray(draft[key]) ? [] : ''
      draftCategoryIds.value = []
      creatingOpen.value = false
    } else await verifyIdentifiers(true)
  } catch (error) { failure.value = error.message } finally { creating.value = false }
}
async function update(extra = {}) {
  if (busy.value || !editForm.value?.reportValidity()) return
  const product = selected.value
  let variants
  try {
    variants = variantEdits.value.filter(variant => !variant.deactivated).map(variant => {
      const original = product.variants.find(item => item.id === variant.id)
      const values = Object.fromEntries(fields.map(field => [field.price ? 'priceCents' : field.key, field.price ? pesosToCents(variant[field.key]) : field.numeric ? Number(variant[field.key]) : variant[field.key]]))
      values.servings = variant.servings.trim() || null
      Object.assign(values, variantPayload(variant))
      values.compareAtPriceCents = variant.compareAtPricePesos.trim() === '' ? null : pesosToCents(variant.compareAtPricePesos)
      if (values.compareAtPriceCents !== null && BigInt(values.compareAtPriceCents) <= BigInt(values.priceCents)) throw new RangeError('El precio anterior debe superar el precio vigente.')
      if (!Object.keys(values).some(key => key === 'nutritionData' ? JSON.stringify(values[key]) !== JSON.stringify(original[key] ?? null) : values[key] !== original[key])) return null
      return { id: variant.id, expectedPriceVersion: original.priceVersion, ...values }
    }).filter(Boolean)
  } catch (error) { failure.value = error.message; return }
  if (await save(`/api/admin/catalog/${product.id}`, { ...edit, brandId: edit.brandId || null, featuredPosition: edit.featuredPosition === '' ? null : Number(edit.featuredPosition), expectedUpdatedAt: product.updatedAt, ...(variants.length ? { variants } : {}), ...extra }, 'PATCH')) {
    const fresh = data.value?.products.find(item => item.id === product.id)
    if (fresh) select(fresh)
    else selected.value = null
  }
}
async function imagesUpdated(productId) {
  await refresh()
  if (selected.value?.id === productId) {
    const fresh = data.value?.products.find(product => product.id === productId)
    if (fresh) { selected.value.images = fresh.images }
  }
}
async function reloadSelected() {
  const productId = selected.value?.id
  await refresh()
  const fresh = data.value?.products.find(product => product.id === productId)
  if (fresh && selected.value?.id === productId) select(fresh)
}
const money = cents => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(cents)/100)
</script>
<template>
  <div>
    <h2 class="text-display-m font-bold">Productos</h2>
    <p class="mt-3 text-body-s text-ink-2">Para configurar Nuestra selección del inicio, abre Gestionar y asigna una prioridad al producto. Se muestran hasta ocho productos publicados y activos, de menor a mayor prioridad.</p>
    <p v-if="failure" role="alert" class="my-4 text-crit">{{ failure }}</p>
    <CategoryManager @created="refreshCategories" />
    <div v-if="classificationError" role="alert" class="my-4"><p>No se pudieron cargar los tipos de suplemento y categorías.</p><UiButton variant="secondary" @click="refreshCategories">Reintentar categorías</UiButton></div>
    <UiButton class="my-4" aria-haspopup="dialog" @click="creatingOpen = true">Crear producto en borrador</UiButton>
    <UiModal :open="creatingOpen" title="Crear producto en borrador" :busy="busy || creating" @close="creatingOpen = false">
      <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
      <p class="my-3 text-ink-2">Ingresa información comercial documentada. Se crea con una variante; después usa Gestionar para agregar sus imágenes y publicarlo.</p>
      <form @submit.prevent="create">
        <fieldset :disabled="busy || creating" class="grid min-w-0 gap-4 md:grid-cols-2">
        <legend class="sr-only">Datos del producto en borrador</legend>
        <UiField id="draft-name" v-model="draft.name" label="Nombre" required maxlength="120" />
        <UiField id="draft-slug" v-model="draft.slug" label="Identificador de URL" hint="Minúsculas, números y guiones. Se comprueba que no esté registrado." :error="slugError" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="150" @blur="verifyIdentifiers()" />
        <UiField id="draft-description" v-model="draft.description" label="Descripción" required maxlength="10000" />
        <BrandSelection v-model="draft.brandId" :brands="detailOptions?.brands" prefix="draft" @created="brandCreated" />
        <ProductTextFields :draft="draft" prefix="draft" />
        <CategorySelection id="draft-category" v-model="draftCategoryIds" :categories="classification?.categories" />
        <UiField v-for="field in fields" :id="`draft-${field.key}`" :key="field.key" v-model="draft[field.key]" :label="field.label" :error="field.key === 'sku' ? skuError : undefined" :hint="field.key === 'presentationLabel' ? 'Sabor y presentación deben ser únicos dentro del mismo producto; pueden repetirse en otros productos.' : field.hint" :type="field.numeric ? 'number' : 'text'" :min="field.numeric ? 1 : undefined" :step="field.numeric ? 1 : undefined" :maxlength="field.numeric ? undefined : field.price ? 24 : 120" :inputmode="field.price ? 'decimal' : undefined" :pattern="field.price ? '[0-9]+([.,][0-9]{1,2})?' : undefined" required @blur="field.key === 'sku' && verifyIdentifiers()" />
        <UiField id="draft-servings" v-model="draft.servings" label="Número de porciones por envase (opcional)" hint="Cantidad indicada en la etiqueta, por ejemplo 30. Se usa para calcular el costo por porción. Déjalo vacío si no aplica; usa punto para decimales." inputmode="decimal" maxlength="15" pattern="(0|[1-9][0-9]{0,9})([.][0-9]{1,4})?" />
        <VariantNutritionFields :variant="draft" prefix="draft" :disabled="busy || creating" />
        <ProductRecommendationsFields :edit="draft" :disabled="busy || creating" />
        <UiField id="draft-reason" v-model="draft.reason" label="Motivo del alta" required maxlength="500" />
        <p role="status" aria-live="polite" class="text-body-s text-ink-2 md:col-span-2">{{ checkingIdentifiers ? 'Comprobando identificadores…' : slugError || skuError }}</p>
        <p v-if="identifierFailure" role="alert" class="text-crit md:col-span-2">{{ identifierFailure }}</p>
        <UiButton v-if="identifierFailure" variant="secondary" :disabled="busy || creating || checkingIdentifiers" @click="verifyIdentifiers">Reintentar comprobación</UiButton>
        <UiButton type="submit" :disabled="busy || creating || checkingIdentifiers || !!slugError || !!skuError || !!identifierFailure">{{ creating ? 'Creando…' : 'Crear borrador' }}</UiButton>
        </fieldset>
      </form>
    </UiModal>
    <UiLoading v-if="status === 'pending'" label="Cargando productos" />
    <div v-else-if="error" role="alert"><p>No se pudieron cargar los productos.</p><UiButton @click="refresh">Reintentar</UiButton></div>
    <template v-else>
      <p v-if="!data?.products.length" class="my-6">No hay productos registrados.</p>
      <ul class="grid gap-4">
        <li v-for="product in data?.products" :key="product.id" class="rounded-sm border border-border bg-surface p-4">
          <div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">{{ product.name }}</h3><p class="text-body-s text-ink-2">{{ product.deactivated ? 'Desactivado' : product.published ? 'Publicado' : 'Borrador' }} · {{ product.slug }}</p></div><UiButton variant="secondary" :disabled="busy" @click="select(product)">Gestionar {{ product.name }}</UiButton></div>
          <p v-if="product.featuredPosition != null" class="mt-2 text-body-s font-semibold text-accent-text">Nuestra selección · Prioridad {{ product.featuredPosition }}{{ product.deactivated || !product.published ? ' · Pendiente de activación y publicación' : '' }}</p>
          <p v-for="variant in product.variants" :key="variant.id" class="mt-2 text-body-s">{{ variant.sku }} · {{ variant.flavor }} · {{ variant.presentationLabel }} · {{ money(variant.priceCents) }}</p>
        </li>
      </ul>
      <nav aria-label="Páginas de productos" class="my-4 flex items-center gap-4"><UiButton variant="secondary" :disabled="page <= 1 || busy" @click="page--">Anterior</UiButton><span>Página {{ page }} de {{ data?.pages || 1 }}</span><UiButton variant="secondary" :disabled="page >= (data?.pages || 1) || busy" @click="page++">Siguiente</UiButton></nav>
    </template>
    <UiModal :open="!!selected" :title="`Editar ${selected?.name || 'producto'}`" :busy="busy" @close="selected = null">
      <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>

      <h3 class="text-display-s font-bold">Editar {{ selected.name }}</h3>
      <UiModal :open="reactivating" title="Reactivar producto" :busy="busy" @close="reactivating = false">
        <p class="mb-4">{{ selected.name }} volverá a estar activo como borrador. Sus imágenes, precios e inventario se conservan; no se publica automáticamente.</p>
        <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
        <form class="grid gap-4" @submit.prevent="reactivate">
          <UiField id="reactivation-reason" v-model="reactivationReason" label="Motivo de la reactivación" required maxlength="500" :disabled="busy" />
          <div class="flex flex-wrap gap-3"><UiButton type="submit" :disabled="busy">Confirmar reactivación</UiButton><UiButton variant="secondary" :disabled="busy" @click="reactivating = false">Cancelar</UiButton></div>
        </form>
      </UiModal>
      <p v-if="selected.creationReason" class="mt-3 text-body-s text-ink-2">Motivo del alta (histórico): {{ selected.creationReason }}</p>
      <p class="mt-3 text-body-s text-ink-2">Revisa y modifica los datos del producto y sus variantes. Guardar y publicar aplica todos los cambios del formulario en una sola operación.</p>
      <form ref="editForm" class="mt-4" @submit.prevent="update()">
        <fieldset :disabled="busy || selected.deactivated" class="grid min-w-0 gap-4 md:grid-cols-2">
        <legend class="sr-only">Datos del producto y sus variantes</legend>
        <UiField id="edit-name" v-model="edit.name" label="Nombre" required maxlength="120" />
        <UiField id="edit-slug" v-model="edit.slug" label="Identificador de URL" required maxlength="150" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        <UiField id="edit-description" v-model="edit.description" label="Descripción" required maxlength="10000" />
        <BrandSelection v-model="edit.brandId" :brands="detailOptions?.brands" :current="selected.brand" prefix="edit" :disabled="busy || selected.deactivated" @created="brandCreated" />
        <ProductTextFields :draft="edit" prefix="edit" />
        <fieldset class="rounded-sm border border-line bg-surface-2 p-4 md:col-span-2">
          <legend class="px-2 font-semibold">Nuestra selección del inicio</legend>
          <p class="mb-3 text-body-s text-ink-2">Asigna una prioridad para incluir este producto. La prioridad 1 aparece antes que la 2. Se muestran los primeros ocho productos publicados y activos; si hay prioridades iguales, se usa un orden estable por identificador.</p>
          <UiField id="edit-featured-position" v-model="edit.featuredPosition" label="Prioridad en el inicio (opcional)" type="number" min="1" max="1000" step="1" inputmode="numeric" hint="Déjalo vacío para quitar el producto de Nuestra selección. Guarda los cambios para aplicar la configuración." />
          <p class="mt-3 text-body-s font-semibold">{{ edit.featuredPosition === '' ? 'Fuera de Nuestra selección' : `Incluido en la selección con prioridad ${edit.featuredPosition}` }}</p>
          <p v-if="!selected.published || selected.deactivated" class="mt-2 text-body-s text-warn">El producto debe estar activo y publicado para aparecer en el inicio.</p>
        </fieldset>
        <CategorySelection id="edit-category" v-model="edit.categoryIds" :categories="classification?.categories" :current-categories="selected.categories" />
        <fieldset v-for="variant in variantEdits" :key="variant.id" :disabled="variant.deactivated" class="grid min-w-0 gap-4 rounded-sm border border-border p-4 md:col-span-2 md:grid-cols-2">
          <legend class="px-2 font-semibold">Variante {{ selected.variants.find(item => item.id === variant.id)?.sku }}{{ variant.deactivated ? ' (desactivada)' : '' }}</legend>
          <UiField v-for="field in fields" :id="`edit-${variant.id}-${field.key}`" :key="field.key" v-model="variant[field.key]" :label="field.label" :hint="field.hint" :type="field.numeric ? 'number' : 'text'" :min="field.numeric ? 1 : undefined" :step="field.numeric ? 1 : undefined" :maxlength="field.numeric ? undefined : field.price ? 24 : 120" :inputmode="field.price ? 'decimal' : undefined" :pattern="field.price ? '[0-9]+([.,][0-9]{1,2})?' : field.key === 'sku' ? '[A-Z0-9][A-Z0-9._-]*' : undefined" required />
          <UiField :id="`edit-${variant.id}-servings`" v-model="variant.servings" label="Número de porciones por envase (opcional)" hint="Cantidad indicada en la etiqueta, por ejemplo 30. Se usa para calcular el costo por porción. Déjalo vacío si no aplica; usa punto para decimales." inputmode="decimal" maxlength="15" pattern="(0|[1-9][0-9]{0,9})([.][0-9]{1,4})?" />
          <UiField :id="`edit-${variant.id}-previous-price`" v-model="variant.compareAtPricePesos" label="Precio anterior en pesos (MXN, opcional)" hint="Si lo indicas, debe ser mayor que el precio vigente. Ejemplo: 180.00." inputmode="decimal" maxlength="24" pattern="[0-9]+([.,][0-9]{1,2})?" />
          <VariantNutritionFields :variant="variant" :prefix="`edit-${variant.id}`" :disabled="busy || variant.deactivated" />
        </fieldset>
        <ProductRecommendationsFields :edit="edit" :product-id="selected.id" :names="selected.recommendations" :disabled="busy || selected.deactivated" />
        <UiField id="edit-reason" v-model="edit.reason" label="Motivo de los cambios" hint="Obligatorio para guardar o publicar los datos revisados. El motivo de la carga de imágenes es independiente." required maxlength="500" />
        </fieldset>
        <div class="mt-6 grid gap-4">
          <div class="flex flex-wrap items-center gap-3" role="group" aria-label="Acciones del formulario">
            <UiButton variant="secondary" :disabled="busy" @click="selected = null">Cerrar edición</UiButton>
            <UiButton variant="secondary" :disabled="busy" @click="select(selected)">Descartar cambios</UiButton>
            <UiButton type="submit" :disabled="busy || selected.deactivated">Guardar cambios</UiButton>
          </div>
          <section class="rounded-sm border border-border bg-surface-2 p-4" aria-label="Publicación en el catálogo">
            <div class="mb-3 flex flex-wrap items-center gap-3">
              <h4 class="font-semibold">Estado en el catálogo</h4>
              <span class="rounded-sm border px-3 py-2 font-bold" :class="selected.published && !selected.deactivated ? 'border-ok bg-ok-soft text-ok' : 'border-warn bg-warn-soft text-warn'" role="status">{{ selected.published && !selected.deactivated ? 'Publicado · Visible para clientes' : 'Sin publicar · Oculto para clientes' }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <UiButton variant="secondary" :disabled="busy || selected.published || !!publicationProblem" :aria-describedby="publicationProblem ? 'publication-requirements' : undefined" @click="update({ published: true })">Publicar</UiButton>
              <UiButton variant="secondary" :disabled="busy || !selected.published || selected.deactivated" @click="withdrawalReason = ''; withdrawing = true">Retirar del catálogo</UiButton>
            </div>
            <p v-if="publicationProblem" id="publication-requirements" class="mt-3 text-body-s text-ink-2">{{ publicationProblem }}</p>
            <p v-else class="mt-3 text-body-s text-ink-2">{{ selected.published ? 'Guardar cambios conserva su publicación. Retirar del catálogo mantiene el producto activo.' : 'Publicar también guarda los cambios del formulario.' }}</p>
          </section>
          <section class="rounded-sm border border-border p-4" aria-label="Activación del producto">
            <div class="mb-3 flex flex-wrap items-center gap-3"><h4 class="font-semibold">Estado del producto</h4><span class="font-bold" :class="selected.deactivated ? 'text-crit' : 'text-ok'">{{ selected.deactivated ? 'Desactivado' : 'Activo' }}</span></div>
            <UiButton v-if="selected.deactivated" variant="secondary" :disabled="busy" @click="reactivationReason = ''; reactivating = true">Activar producto</UiButton>
            <UiButton v-else variant="secondary" :disabled="busy || !edit.reason.trim()" @click="update({ deactivate: true, published: false })">Desactivar producto</UiButton>
            <p class="mt-3 text-body-s text-ink-2">{{ selected.deactivated ? 'Activar conserva sus datos y lo devuelve a borrador; después podrás publicarlo.' : 'Desactivar retira el producto del catálogo. Escribe el motivo de los cambios para habilitar esta acción.' }}</p>
          </section>
        </div>
      </form>
      <UiButton v-if="failure" variant="secondary" class="mt-4" :disabled="busy" @click="reloadSelected">Actualizar producto y descartar cambios</UiButton>
      <UiModal :open="withdrawing" title="Confirmar retiro del catálogo" :busy="busy" @close="withdrawing = false">
        <p class="mb-4">{{ selected.name }} dejará de ser visible para los clientes. Esta acción no guarda los cambios pendientes del formulario.</p>
        <p v-if="failure" role="alert" class="mb-4 text-crit">{{ failure }}</p>
        <form class="grid gap-4" @submit.prevent="withdraw"><UiField id="withdrawal-reason" v-model="withdrawalReason" label="Motivo del retiro" required maxlength="500" :disabled="busy" /><div class="flex flex-wrap gap-3"><UiButton type="submit" :disabled="busy">Confirmar retiro</UiButton><UiButton variant="secondary" :disabled="busy" @click="withdrawing = false">Cancelar</UiButton></div></form>
      </UiModal>
      <AddProductVariant :product="selected" :fields="fields" @created="variantCreated" />
      <ProductImages :key="selected.id" :product="selected" @updated="imagesUpdated" />
    </UiModal>
  </div>
</template>
