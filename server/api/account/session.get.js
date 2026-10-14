import { accountRequest } from '../../features/accounts/account-http.js'
export default defineEventHandler(event => accountRequest(event, 'session'))
