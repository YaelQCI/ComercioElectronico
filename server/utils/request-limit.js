import { createHash } from 'node:crypto'
export class RequestLimitError extends Error { constructor() { super('Demasiados intentos. Intenta de nuevo más tarde.'); this.status = 429 } }
export async function limitRequest(db, key, max = 10, windowSeconds = 900) {
  if (typeof key !== 'string' || !Number.isInteger(max) || max < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) throw new TypeError('Límite inválido')
  const hash = createHash('sha256').update(key).digest('hex')
  const [row] = await db.$queryRaw`
    INSERT INTO "RequestLimit" ("keyHash", "hits", "expiresAt") VALUES (${hash}, 1, clock_timestamp() + ${windowSeconds} * interval '1 second')
    ON CONFLICT ("keyHash") DO UPDATE SET
      "hits" = CASE WHEN "RequestLimit"."expiresAt" <= clock_timestamp() THEN 1 ELSE LEAST("RequestLimit"."hits" + 1, 2147483647) END,
      "expiresAt" = CASE WHEN "RequestLimit"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + ${windowSeconds} * interval '1 second' ELSE "RequestLimit"."expiresAt" END
    RETURNING "hits"`
  if (row.hits > max) throw new RequestLimitError()
}
