import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { createPolicies } from './policy-repository.js'
export async function policyAdministrationRequest(event) {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    const identity = await accountIdentity(event)
    return await createPolicies(getDatabase()).administration(identity.user.id)
  } catch (error) {
    throw createError({ statusCode: error instanceof AccountError ? error.status : 503, statusMessage: error instanceof AccountError ? error.message : 'No pudimos consultar las políticas.' })
  }
}
