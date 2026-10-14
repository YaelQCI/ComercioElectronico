import { claimRequest } from '../../../features/after-sales/claim-http.js'
export default defineEventHandler(event=>claimRequest(event,true))
