import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { emailAddress } from '../server/features/accounts/credentials.js'
import { randomUUID } from 'node:crypto'
const [email, apply] = process.argv.slice(2)
if (!email || (apply && apply !== '--apply') || process.argv.length > 4) throw new Error('Uso: node scripts/grant-administrator.mjs correo [--apply]. Requiere acceso local privilegiado a DATABASE_URL.')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  const normalized = emailAddress(email)
  await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { emailNormalized: normalized } })
    if (!user || user.deletedAt) throw new Error('Crear primero una cuenta activa mediante registro.')
    if (!apply) { console.log('Cuenta activa encontrada. Sin --apply no se cambió rol.'); return }
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (current.deletedAt) throw new Error('Cuenta desactivada.')
    if (current.role === 'ADMIN') { console.log('La cuenta ya es administradora.'); return }
    await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN', authVersion: { increment: 1 } } })
    await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: 'Cambio de rol por propietario' } })
    await tx.auditEvent.create({ data: { actorType: 'SYSTEM', action: 'BOOTSTRAP_ADMIN', entityType: 'User', entityId: user.id, reason: 'Procedimiento local del propietario con acceso privilegiado a BD', safeBefore: { role: current.role }, safeAfter: { role: 'ADMIN' }, correlationId: randomUUID() } })
    console.log('Rol asignado con auditoría y sesiones revocadas. Iniciar sesión nuevamente.')
  })
} finally { await db.$disconnect() }
