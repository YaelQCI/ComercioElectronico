import { packageAdministrationRequest } from '../../../features/shipping/package-administration-http.js'
export default defineEventHandler(event => packageAdministrationRequest(event, 'list'))
