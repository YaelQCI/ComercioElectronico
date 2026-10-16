import { getDatabase } from '../utils/database.js'
import { ensureInitialPolicies } from '../features/policies/initial-policies.js'
export default defineNitroPlugin(async () => {
  await ensureInitialPolicies(getDatabase())
})
