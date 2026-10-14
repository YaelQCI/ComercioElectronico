import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
const slugs = new Set(['privacidad', 'terminos', 'devoluciones'])
function validSlug(slug) { if (!slugs.has(slug)) throw new AccountError(404, 'Política no encontrada.'); return slug }
export function createPolicies(db) {
  return {
    async published(slug) {
      validSlug(slug)
      const p = await db.contentPage.findFirst({ where: { slug, publishedAt: { lte: new Date() } } })
      return p ? { slug: p.slug, title: p.title, content: p.content, version: p.version, publishedAt: p.publishedAt.toISOString() } : null
    },
    async publish(adminId, slug, input) {
      validSlug(slug)
      if (input?.approved !== true || !Number.isSafeInteger(input?.expectedVersion) || input.expectedVersion < 0) throw new AccountError(400, 'Se requiere aprobación explícita y versión esperada.')
      const title = accountText(input.title, 'Título', 160), content = accountText(input.content, 'Contenido', 50000)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        // Also serializes first publication across different administrators.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${slug}`}, 0))::text`
        const current = await tx.contentPage.findUnique({ where: { slug } })
        if ((current?.version ?? 0) !== input.expectedVersion) throw new AccountError(409, 'La política cambió. Revisa su versión antes de publicar.')
        const data = { title, content, publishedAt: new Date(), updatedById: adminId }
        const saved = current ? await tx.contentPage.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } }) : await tx.contentPage.create({ data: { ...data, slug } })
        await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', action: 'PUBLISH_POLICY', entityType: 'ContentPage', entityId: saved.id, reason: 'Contenido aprobado explícitamente', safeBefore: current ? { version: current.version, title: current.title, content: current.content } : undefined, safeAfter: { version: saved.version, title, content }, correlationId: `policy:${slug}:${saved.version}` } })
        return { slug, version: saved.version }
      })
    },
  }
}
