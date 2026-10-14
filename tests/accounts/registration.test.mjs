import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordConfirmationError } from '../../shared/features/accounts/registration.js'
test('confirmación obligatoria y coincidencia exacta sin normalizar contraseña', () => {
  assert.equal(passwordConfirmationError('Contraseña segura 123', 'Contraseña segura 123'), '')
  for (const confirmation of [undefined, null, '', 123]) assert.equal(passwordConfirmationError('Contraseña segura 123', confirmation), 'Confirma tu contraseña.')
  for (const confirmation of ['contraseña segura 123', 'Contraseña segura 123 ', 'Otra contraseña']) assert.equal(passwordConfirmationError('Contraseña segura 123', confirmation), 'Las contraseñas no coinciden.')
})
