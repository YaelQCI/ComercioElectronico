// Reporte de integridad sin imprimir registros ni credenciales.
import pg from 'pg'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.startsWith('/fitness_migration_test')) throw new Error('Usar base exclusiva fitness_migration_test*')
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 })
await client.connect()
try {
  const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)).rows
  const report = { tables: {}, constraints: [], triggers: [] }
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""')
    report.tables[tablename] = (await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM "${name}" t`)).rows[0]
  }
  report.constraints = (await client.query(`SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' ORDER BY c.conname, definition`)).rows
  // pg_dump flattens associative AND in this single all-AND predicate.
  // Normalize its redundant parentheses; retain exact definitions elsewhere.
  for (const constraint of report.constraints) {
    if (constraint.name === 'Review_rating_range') constraint.definition = constraint.definition.replace(/[()]/g, '')
  }
  report.triggers = (await client.query(`SELECT t.tgname AS name, pg_get_triggerdef(t.oid) AS definition, t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgname`)).rows
  console.log(JSON.stringify(report))
} finally { await client.end() }
