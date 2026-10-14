export function passwordConfirmationError(password, confirmation) {
  if (typeof confirmation !== 'string' || !confirmation.length) return 'Confirma tu contraseña.'
  if (typeof password !== 'string' || password !== confirmation) return 'Las contraseñas no coinciden.'
  return ''
}
