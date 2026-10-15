import { administrationRequest } from '../../../features/administration/administration-http.js'
export default defineEventHandler(event => administrationRequest(event, 'check'))
