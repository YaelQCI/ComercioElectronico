// El SQL versionado mantiene el perfil inicial y la idempotencia del ledger.
// Se invoca después del alta del primer almacén, dentro de la misma transacción.
export async function initializeDemoStock(database) {
  const [result] = await database.$queryRaw`SELECT initialize_demo_catalog_stock() AS created`
  return result.created
}
