# Administración por herramientas HTTP (#34)

Modalidad elegida: comandos/herramientas HTTP autenticadas, sin dashboard. Crear cuenta por registro y, exclusivamente con acceso privilegiado local a la BD, revisar `node scripts/grant-administrator.mjs correo`; `--apply` asigna ADMIN, audita y revoca sesiones. No se ejecutó sobre cuentas reales. No exponer esta herramienta por HTTP ni conceder su acceso a clientes. Volver a iniciar sesión tras asignación.

Operaciones requieren cookies de cuenta, Origin propio y ADMIN activo revalidado en transacción:

| Método / ruta | Intención y campos |
| --- | --- |
| POST `/api/admin/catalog` | Borrador: name, description, slug, variants con SKU/presentación/contenido/precio centavos texto/medidas reales; reason obligatorio |
| PATCH `/api/admin/catalog/:id` | Textos, published boolean, deactivate true, categoryIds (primera principal), reason |
| PATCH `/api/admin/variants/:id` | priceCents/compareAtPriceCents, medidas, deactivate true, expectedPriceVersion, reason |
| POST `/api/admin/inventory` | lotId, delta entero no cero, reason, idempotencyKey; movimiento auditado, nunca escribir contadores |
| GET `/api/admin/users?page=1` | Veinte cuentas por página; ID, correo, nombre, rol y desactivación; sin hashes/tokens |
| POST `/api/admin/users/:id/deactivate` | reason; conserva historial y revoca sesiones, no desactiva otro administrador |

Los borradores no se venden. Publicación requiere variantes activas e imagen frontal documentada. Alta/media/lotes documentados también disponen del importador local de #3; no hay carga de archivos arbitraria desde navegador. Cambios de precio usan versión para impedir sobrescritura silenciosa. Catálogo/carrito leen estado y precio vigentes; cotización revalida huella. Un SKU/correo desactivado sigue siendo único. No se crean guías Envia ni se cobra Stripe desde estas operaciones.

Verificación: dos pruebas PostgreSQL aislado de alta, permisos cliente, versión/entrada inválida de precio, categorías/baja conservando variantes, auditoría, ajuste idempotente/retiro inválido, desactivación/revocación y DTO de usuarios. Build y diff check. Fixtures sintéticas, sin cambios de usuarios/productos comerciales.

Pendiente para cerrar: edición/alta completa de variantes, medios/certificados/lotes, combos y cupones, configuración de origen/cajas, procedimientos de reactivación y gestión restringida de administradores; gestión posventa de #28 y demostración operativa integrada. El importador existente y los endpoints actuales cubren solo parte del alcance ampliado.
