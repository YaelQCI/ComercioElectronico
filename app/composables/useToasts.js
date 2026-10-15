export function useToasts() {
  const toasts = useState('confirmation-toasts', () => [])
  function dismiss(id) { toasts.value = toasts.value.filter(item => item.id !== id) }
  function confirm(text) {
    if (!import.meta.client || !text) return
    toasts.value = [...toasts.value.slice(-3), { id: crypto.randomUUID(), text }]
  }
  return { toasts, confirm, dismiss }
}

export function useConfirmationMessage(state = ref('')) {
  const { confirm } = useToasts()
  return computed({ get: () => state.value, set: value => { state.value = value; if (value) confirm(value) } })
}
