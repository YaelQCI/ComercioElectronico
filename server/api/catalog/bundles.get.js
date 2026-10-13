import { readCatalog } from '../../features/catalog/catalog-http.js'
export default defineEventHandler(() => readCatalog(async repo => ({ bundles: await repo.bundles() })))
