import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordConfirmationError } from '../../shared/features/accounts/registration.js'
import { emailAddress, validPassword } from '../../server/features/accounts/credentials.js'
import { createAccounts } from '../../server/features/accounts/account-repository.js'
import { normalizeEmail } from '../../shared/features/notifications/email.js'

test('registro explica los errores de correo y los límites reales de contraseña', () => {
  for (const [value, message] of [['', /Escribe tu correo/], ['sin-arroba', /formato válido/], [`${'a'.repeat(250)}@example.invalid`, /254 caracteres/]]) {
    assert.throws(() => emailAddress(value), e => e.status === 400 && message.test(e.message))
  }
  for (const [value, message] of [['', /Escribe una contraseña/], ['corta', /al menos 12 caracteres/], ['á'.repeat(129), /256 bytes/]]) {
    assert.throws(() => validPassword(value), e => e.status === 400 && message.test(e.message))
  }
  assert.equal(validPassword('a'.repeat(12)), 'a'.repeat(12))
  assert.equal(validPassword('á'.repeat(128)), 'á'.repeat(128))
})

test('registro explica correo duplicado sin confundir otros conflictos con duplicados', async () => {
  const input = { email: 'registro@example.invalid', displayName: 'Prueba', password: 'Contraseña de prueba 123', passwordConfirmation: 'Contraseña de prueba 123' }
  for (const exists of [true, false]) {
    const conflict = Object.assign(new Error('Conflicto'), { code: 'P2002' })
    const accounts = createAccounts({ $transaction: async () => { throw conflict }, user: { findUnique: async query => {
      assert.deepEqual(query, { where: { emailNormalized: input.email }, select: { id: true } })
      return exists ? { id: 'cuenta-existente' } : null
    } } }, '')
    await assert.rejects(accounts.register(input), e => exists ? e.status === 409 && /Ya existe una cuenta con ese correo/.test(e.message) : e === conflict)
  }
})
test('confirmación obligatoria y coincidencia exacta sin normalizar contraseña', () => {
  assert.equal(passwordConfirmationError('Contraseña segura 123', 'Contraseña segura 123'), '')
  for (const confirmation of [undefined, null, '', 123]) assert.equal(passwordConfirmationError('Contraseña segura 123', confirmation), 'Confirma tu contraseña.')
  for (const confirmation of ['contraseña segura 123', 'Contraseña segura 123 ', 'Otra contraseña']) assert.equal(passwordConfirmationError('Contraseña segura 123', confirmation), 'Las contraseñas no coinciden.')
})

test('cuentas y avisos comparten formato de correo y conservan puntos y etiquetas válidas', () => {
  for (const invalid of ['usuario', 'usuario@dominio', '@dominio.com', 'usuario@@dominio.com', 'a b@dominio.com', '.usuario@dominio.com', 'usuario.@dominio.com', 'a..b@dominio.com', 'a@dominio..com', 'a@-dominio.com', 'a@dominio-.com']) {
    assert.throws(() => emailAddress(invalid), error => error.status === 400 && /formato válido/.test(error.message))
    assert.throws(() => normalizeEmail(invalid))
  }
  for (const valid of ['nombre@dominio.com', '181914@upslp.edu.mx', ' A.B+tag@Example.Invalid ']) assert.equal(emailAddress(valid), normalizeEmail(valid))
})
