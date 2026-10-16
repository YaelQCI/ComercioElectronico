import { productDetailsRequest } from '../../../features/catalog/product-details-http.js'
export default defineEventHandler(event => productDetailsRequest(event, 'brand'))
