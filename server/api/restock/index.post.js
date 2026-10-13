import { restockRequest } from '../../features/restock/restock-http.js'
export default defineEventHandler(event => restockRequest(event, 'subscribe'))
