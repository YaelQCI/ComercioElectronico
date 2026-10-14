# Consulta y ciclo operativo de pedidos (#35)

`/pedidos` y GET `/api/orders` consultan pedidos propios paginados y snapshots de líneas/importes; GET `/api/orders/:id` agrega dirección histórica. Sesión activa requerida; pedido ajeno responde 404. No se consulta por correo/número público. Cuenta enlaza al historial. Estado operativo y estado de dinero se muestran separados.

Herramientas administrativas: GET `/api/admin/orders` y `/:id`, POST `/api/admin/orders/:id/status` con status, expectedStatus, reason e idempotencyKey. ADMIN activo revalidado, bloqueo del pedido y transición CONFIRMED → PREPARING → SHIPPED → DELIVERED; no se marca pagado desde operación administrativa. Requiere dinero PAID/NOT_REQUIRED/PARTIALLY_REFUNDED; snapshots permanecen protegidos por SQL. Historial contiene responsable, motivo y clave única; reintento exacto no duplica y reutilización para otra operación da 409. Envia no genera guías al marcar enviado.

Verificación: prueba PostgreSQL aislado con pedido completo sintético sin cobro; consulta propia/ajena, admin cliente rechazado, avance concurrente/idempotente, recorrido entregado y conservación de nombre histórico tras cambiar producto. Build y diff check correctos.

Pendiente para cerrar: acceso invitado opaco y vinculación verificada, cancelación con devolución de recursos/reembolsos, integración de pagos y reconciliación, acreditación de puntos al entregar, filtros administrativos completos y demostración visual/operativa. No se habilita cancelación como simple cambio de estado ni se inventa confirmación de pago.
