import { policyRequest } from '../../features/policies/policy-http.js'
export default defineEventHandler(event => policyRequest(event, true))
