import { getDatabase } from '../utils/database.js'
import { ensureSupplementCategories } from '../features/catalog/supplement-categories.js'

export default defineNitroPlugin(async () => {
  await ensureSupplementCategories(getDatabase())
})
