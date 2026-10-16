export function useToasts() {
  const toasts = useState('confirmation-toasts', () => [])
  function dismiss(id) { toasts.value = toasts.value.filter(item => item.id !== id) }
  function add(text, kind) {
    if (!import.meta.client || !text) return
    if (kind === 'error' && toasts.value.some(item => item.kind === kind && item.text === text)) return
    toasts.value = [...toasts.value.slice(-3), { id: crypto.randomUUID(), text, kind }]
  }
  const confirm = text => add(text, 'success')
  const error = text => add(text, 'error')
  return { toasts, confirm, error, dismiss }
}

export function useConfirmationMessage(state = ref('')) {
  const { confirm } = useToasts()
  return computed({ get: () => state.value, set: value => { state.value = value; if (value) confirm(value) } })
}
