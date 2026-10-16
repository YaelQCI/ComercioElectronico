import { mexicanStates } from './mexican-states.js'
import { foldSearch } from '../catalog/search.js'

export function savedDestination(address) {
  const state = String(address.state ?? '').trim()
  const normalized = foldSearch(state).replace(/^estado de /, '')
  const match = mexicanStates.find(item => item.value === state.toUpperCase() || foldSearch(item.label) === normalized)
  return {
    name: address.recipientName ?? '', phone: address.phone ?? '',
    street: [
      [address.street, address.exteriorNumber, address.interiorNumber ? `int. ${address.interiorNumber}` : ''].filter(Boolean).join(' '),
      address.district,
    ].filter(Boolean).join(', '),
    city: address.city ?? '', state: match?.value ?? '',
    country: address.countryCode ?? 'MX', postalCode: address.postalCode ?? '',
  }
}
