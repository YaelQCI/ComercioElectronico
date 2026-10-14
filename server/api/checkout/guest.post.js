import { checkoutRequest } from '../../features/checkout/checkout-http.js'
export default defineEventHandler(event=>checkoutRequest(event,true))
