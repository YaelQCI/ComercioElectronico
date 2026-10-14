import { AccountError } from '../features/accounts/credentials.js'
// Revalidate current role under row lock within the business transaction.
export async function requireAdministrator(tx, userId) {
  if (typeof userId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(userId)) throw new AccountError(403, 'Operación restringida a administración.')
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt || user.role !== 'ADMIN') throw new AccountError(403, 'Operación restringida a administración.')
  return user
}
