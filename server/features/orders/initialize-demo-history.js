// Aplica exclusivamente el historial académico definido por la migración.
export async function initializeDemoHistory(database) {
  const [result] = await database.$queryRaw`SELECT initialize_demo_customers_orders_reviews() AS created`
  return result.created
}
