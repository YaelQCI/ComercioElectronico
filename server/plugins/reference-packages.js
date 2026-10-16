import { getDatabase } from '../utils/database.js'
import { ensureReferencePackages } from '../features/shipping/reference-packages.js'
export default defineNitroPlugin(async () => {
  await ensureReferencePackages(getDatabase())
})
