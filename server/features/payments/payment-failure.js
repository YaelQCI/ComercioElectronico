import { PaymentError } from './stripe-client.js'
import { AccountError } from '../accounts/credentials.js'
import { CartError } from '../cart/cart-repository.js'
import { ShippingError } from '../shipping/shipping-quotes.js'
import { ShippingProviderError } from '../shipping/envia-rates.js'
import { InventoryError } from '../../../shared/features/inventory/fefo.js'
import { RequestLimitError } from '../../utils/request-limit.js'
export function paymentFailure(error) {
  if ([PaymentError, AccountError, CartError, ShippingError, RequestLimitError].some(type => error instanceof type)) return { statusCode: error.status, statusMessage: error.message }
  if (error instanceof ShippingProviderError) return { statusCode: 503, statusMessage: error.message }
  if (error instanceof InventoryError) return { statusCode: 409, statusMessage: error.message }
  return null
}
export function safePaymentDiagnostic(error, action) {
  const code = value => typeof value === 'string' && /^[A-Za-z0-9_]{1,60}$/.test(value) ? value : null
  return { operation: ['start', 'status', 'cancel', 'webhook'].includes(action) ? action : 'unknown', errorType: code(error?.name), code: code(error?.code), databaseCode: code(error?.meta?.driverAdapterError?.cause?.originalCode) }
}
