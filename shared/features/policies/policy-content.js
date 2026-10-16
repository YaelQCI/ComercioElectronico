export function policyContent(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Escribe el contenido de la política.')
  if (value.trim().length > 50000) throw new Error('El contenido de la política no debe superar 50,000 caracteres.')
  // Permitir tabulación y saltos de línea de Windows, Linux y macOS; rechazar otros controles.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('El contenido incluye caracteres de control no permitidos. Pega el texto sin formato.')
  return value.replace(/\r\n?/g, '\n').trim()
}
