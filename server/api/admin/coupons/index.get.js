import { couponAdministrationRequest } from '../../../features/coupons/administration-http.js'
export default defineEventHandler(event => couponAdministrationRequest(event, 'list'))
