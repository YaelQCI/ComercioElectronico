import { paymentRequest } from '../../features/payments/payment-http.js'
export default defineEventHandler(event=>paymentRequest(event,'cancel'))
