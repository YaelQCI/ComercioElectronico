import { orderRequest } from '../../../features/orders/order-http.js'
export default defineEventHandler(event => orderRequest(event, 'list', true))
