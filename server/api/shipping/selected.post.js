import { shippingRequest } from '../../features/shipping/shipping-http.js'
export default defineEventHandler(event => shippingRequest(event, 'select'))
