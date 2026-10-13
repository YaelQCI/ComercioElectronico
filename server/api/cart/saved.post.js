import { cartRequest } from '../../features/cart/cart-http.js'
export default defineEventHandler(event => cartRequest(event, 'move'))
