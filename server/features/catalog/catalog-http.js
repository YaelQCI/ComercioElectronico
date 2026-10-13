import { getDatabase } from '../../utils/database.js'
import { createCatalogRepository } from './catalog-repository.js'

export async function readCatalog(operation) {
  try { return await operation(createCatalogRepository(getDatabase())) }
  catch { throw createError({ statusCode: 503, statusMessage: 'El catálogo no está disponible. Intenta de nuevo.' }) }
}
