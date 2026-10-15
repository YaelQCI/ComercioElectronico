import { createDraftIdentifierCheck } from './draft-identifier-check.js'

export function useDraftIdentifiers(draft) {
  const pending = ref(false), failure = ref(''), result = ref(null)
  let timer, lastInput = '', checkedInput = ''
  const slug = computed(() => draft.slug.trim()), sku = computed(() => draft.sku.trim())
  const slugFormatError = computed(() => slug.value && (slug.value.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)) ? 'Usa minúsculas, números y guiones para el identificador de URL (máximo 150 caracteres).' : '')
  const skuFormatError = computed(() => sku.value && (sku.value.length > 120 || !/^[A-Z0-9][A-Z0-9._-]*$/.test(sku.value)) ? 'Usa mayúsculas, números y los separadores punto, guion o guion bajo para el SKU.' : '')
  const slugError = computed(() => slugFormatError.value || (result.value?.slugExists ? 'Este identificador de URL ya está registrado. Utiliza uno diferente.' : ''))
  const skuError = computed(() => skuFormatError.value || (result.value?.skuExists ? 'Este SKU ya está registrado. Utiliza uno diferente.' : ''))
  const checker = createDraftIdentifierCheck(input => $fetch('/api/admin/catalog/check', { method: 'POST', body: input }), state => {
    result.value = state.result; failure.value = state.failure; pending.value = false; checkedInput = lastInput
  })
  async function verify(force = false) {
    clearTimeout(timer)
    const input = { slug: slugFormatError.value ? '' : slug.value, sku: skuFormatError.value ? '' : sku.value }
    if (!force && result.value && checkedInput === JSON.stringify(input)) return !slugError.value && !skuError.value && !!slug.value && !!sku.value
    checker.invalidate()
    result.value = null; failure.value = ''
    if (!input.slug && !input.sku) { pending.value = false; return false }
    lastInput = JSON.stringify(input)
    pending.value = true
    const checked = await checker.check(input)
    return !!checked && !slugError.value && !skuError.value && !!slug.value && !!sku.value
  }
  watch([slug, sku], () => {
    clearTimeout(timer); checker.invalidate()
    result.value = null; failure.value = ''
    pending.value = !!((slug.value && !slugFormatError.value) || (sku.value && !skuFormatError.value))
    if (pending.value) timer = setTimeout(verify, 400)
  }, { flush: 'sync' })
  onBeforeUnmount(() => { clearTimeout(timer); checker.invalidate() })
  return { pending, failure, slugError, skuError, verify }
}
