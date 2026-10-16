import { AccountError, accountText } from '../accounts/credentials.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { requiredPolicies } from '../../../shared/features/policies/required-policies.js'
import { policyContent } from '../../../shared/features/policies/policy-content.js'
const slugs = new Set(requiredPolicies.map(policy => policy.slug))
function validSlug(slug) { if (!slugs.has(slug)) throw new AccountError(404, 'Política no encontrada.'); return slug }
export function createPolicies(db) {
  return {
    async administration(adminId) {
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        const pages = await tx.contentPage.findMany({ where: { slug: { in: requiredPolicies.map(policy => policy.slug) } } })
        return { policies: requiredPolicies.map(policy => {
          const page = pages.find(item => item.slug === policy.slug)
          return { slug: policy.slug, title: page?.title ?? policy.title, content: page?.content ?? '', version: page?.version ?? 0, publishedAt: page?.publishedAt?.toISOString() ?? null, published: !!page?.publishedAt && page.publishedAt <= new Date() }
        }) }
      })
    },
    async published(slug) {
      validSlug(slug)
      const p = await db.contentPage.findFirst({ where: { slug, publishedAt: { lte: new Date() } } })
      return p ? { slug: p.slug, title: p.title, content: p.content, version: p.version, publishedAt: p.publishedAt.toISOString() } : null
    },
    async publish(adminId, slug, input) {
      validSlug(slug)
      if (input?.approved !== true || !Number.isSafeInteger(input?.expectedVersion) || input.expectedVersion < 0) throw new AccountError(400, 'Se requiere aprobación explícita y versión esperada.')
      const title = accountText(input.title, 'Título', 160)
      let content
      try { content = policyContent(input.content) } catch (error) { throw new AccountError(400, error.message) }
      const reason = input.reason === undefined ? 'Contenido aprobado explícitamente' : accountText(input.reason, 'Motivo', 500)
      return db.$transaction(async tx => {
        await requireAdministrator(tx, adminId)
        // Also serializes first publication across different administrators.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${slug}`}, 0))::text`
        const current = await tx.contentPage.findUnique({ where: { slug } })
        if ((current?.version ?? 0) !== input.expectedVersion) throw new AccountError(409, 'La política cambió. Revisa su versión antes de publicar.')
        const data = { title, content, publishedAt: new Date(), updatedById: adminId }
        const saved = current ? await tx.contentPage.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } }) : await tx.contentPage.create({ data: { ...data, slug } })
        await tx.auditEvent.create({ data: { actorId: adminId, actorType: 'ADMIN', action: 'PUBLISH_POLICY', entityType: 'ContentPage', entityId: saved.id, reason, safeBefore: current ? { version: current.version, title: current.title, content: current.content } : undefined, safeAfter: { version: saved.version, title, content }, correlationId: `policy:${slug}:${saved.version}` } })
        return { slug, version: saved.version }
      })
    },
  }
}
