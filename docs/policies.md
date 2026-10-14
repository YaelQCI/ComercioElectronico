# Políticas y contacto (#27)

Privacidad/términos/devoluciones consultan `ContentPage` publicada desde el módulo policies, mostrando texto seguro sin HTML, versión y fecha; ausencia declara aprobación/publicación pendiente. Fallo de base distingue indisponibilidad y ofrece retry. Slug ajeno responde 404. `/contacto` usa configuración pública validada de correo/teléfono/horario y no inventa canales. Contacto se enlaza desde cada política.

Publicación: POST `/api/policies/:slug`, sesión ADMIN activa, Origin propio y `{title, content, expectedVersion, approved: true}`. Alta espera versión cero; actualización espera versión vigente. Bloqueo asesor por slug impide sobrescrituras concurrentes. Historial de contenido/versión se conserva en AuditEvent con responsable. Endpoint no interpreta un texto como legalmente aprobado por sí mismo: la revisión corresponde al responsable antes de usarlo.

Pendiente para cerrar: contenido definitivo aprobado que cubra todas las reglas de #27 y tratamientos realmente habilitados, contactos verificados, revisión legal del responsable y comprobación visual/navegación. No se redactan términos comerciales ficticios ni se promete cumplimiento legal. Cambios de política no alteran snapshots históricos de pedidos.

Verificación: prueba PostgreSQL aislado de rol, aprobación, publicación concurrente (una acepta y otra 409), versión, auditoría y slug inválido; build y diff check. La política sintética permanece exclusivamente en base fitness_migration_test*, no en la tienda comercial.
