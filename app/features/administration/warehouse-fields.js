import { mexicanStates } from '~~/shared/features/shipping/mexican-states.js'

export const warehouseFields = [
  { key: 'name', label: 'Nombre del almacén' },
  { key: 'recipientName', label: 'Remitente' },
  { key: 'contactName', label: 'Persona de contacto' },
  { key: 'phone', label: 'Teléfono', type: 'tel', maxlength: 25 },
  { key: 'postalCode', label: 'Código postal', maxlength: 5, pattern: '[0-9]{5}', inputmode: 'numeric' },
  { key: 'state', label: 'Estado', options: [{ value: '', label: 'Selecciona un estado' }, ...mexicanStates] },
  { key: 'city', label: 'Ciudad' },
  { key: 'district', label: 'Colonia' },
  { key: 'street', label: 'Calle' },
  { key: 'exteriorNumber', label: 'Número exterior' },
  { key: 'interiorNumber', label: 'Número interior (opcional)', optional: true },
  { key: 'references', label: 'Referencias (opcional)', optional: true, maxlength: 500 },
]
