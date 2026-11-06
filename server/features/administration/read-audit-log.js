import { Prisma } from '../../../generated/prisma/client.ts'
import { AccountError } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'

// Consulta los historiales existentes sin duplicarlos ni modificar su contenido.
export function createAuditLog(db) {
  return async (adminId, { page = '1', q = '', source = '' } = {}) => {
    if (typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page) || Number(page) > 10000) throw new AccountError(400, 'Página inválida.')
    if (typeof q !== 'string' || q.length > 120) throw new AccountError(400, 'La búsqueda admite hasta 120 caracteres.')
    if (!['', 'audit', 'inventory', 'orders'].includes(source)) throw new AccountError(400, 'Historial inválido.')
    const currentPage = Number(page), query = q.trim()
    // LIKE trata la búsqueda como texto literal, incluidos %, _ y barras.
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
    return db.$transaction(async tx => {
      await requireAdministrator(tx, adminId)
      const [result] = await tx.$queryRaw(Prisma.sql`
        WITH history AS (
          SELECT 'audit' AS source, id, "actorId", "actorType"::text AS "actorType", action,
                 "entityType", "entityId", reason, "createdAt"
          FROM "AuditEvent"
          UNION ALL
          SELECT 'inventory', id, "actorId", "actorType"::text, kind::text,
                 'InventoryLot', "lotId", reason, "createdAt"
          FROM "InventoryMovement" WHERE "actorType" = 'ADMIN'
          UNION ALL
          SELECT 'orders', id, "actorId", "actorType"::text,
                 COALESCE("fromStatus"::text, 'INICIO') || ' → ' || "toStatus"::text,
                 'Order', "orderId", reason, "createdAt"
          FROM "OrderStatusHistory" WHERE "actorType" = 'ADMIN'
        ), filtered AS (
          SELECT h.*, u."displayName" AS "actorName", u.email AS "actorEmail"
          FROM history h LEFT JOIN "User" u ON u.id = h."actorId"
          WHERE (${source} = '' OR h.source = ${source})
            AND (${query} = '' OR concat_ws(' ', h.reason, h.action, h."entityType", h."entityId"::text,
                 u."displayName", u.email) ILIKE ${pattern})
        )
        SELECT (SELECT count(*)::int FROM filtered) AS total,
          COALESCE((SELECT jsonb_agg(row_to_json(entry) ORDER BY entry."createdAt" DESC, entry.source, entry.id DESC)
            FROM (SELECT * FROM filtered ORDER BY "createdAt" DESC, source, id DESC
                  LIMIT 20 OFFSET ${(currentPage - 1) * 20}) entry), '[]'::jsonb) AS events
      `)
      return { ...result, page: currentPage, pages: Math.max(1, Math.ceil(result.total / 20)) }
    })
  }
}
