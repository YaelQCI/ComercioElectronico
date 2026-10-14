# Flujo de pago y cancelación (#25)

Stripe #30 ya implementa tarjetas, consulta/confirmación por proveedor, rechazo/pendiente/cierre/reintento, reservas conjuntas y reembolsos. Esta ampliación hace operable la cancelación administrativa de pedidos confirmados antes del envío: POST `/api/admin/orders/:id/cancel` con `reason` y `idempotencyKey` UUID. Herramientas HTTP autenticadas, ADMIN actual y Origin propio; no dashboard adicional.

Pedido CONFIRMED/PREPARING y dinero PAID/NOT_REQUIRED/PARTIALLY_REFUNDED; bloquear estado e impedir carrera contra SHIPPED. Cancelar registra responsable/motivo/fecha y restaura cada unidad al lote original exactamente una vez. Lote bloqueado/vencido pasa a existencias no vendibles. Cancelación no enviada no necesita inspección de retorno; devoluciones entregadas sí, en #28.

Se reserva reembolso de dinero/puntos remanentes por unidad y envío original efectivamente cobrado, descontando asignaciones previas o pendientes que no estén FAILED. No se reactiva un cupón consumido ni se marca dinero devuelto al cancelar. Solicitud/outbox conservan historial; ejecución financiera en el endpoint de #30. Reembolso exclusivo de puntos se liquida localmente y no crea un reintegro Stripe ficticio. Si no hubo dinero, estado monetario permanece NOT_REQUIRED. Un pedido gratuito sin canje se cancela/restaura sin crear solicitud de importe cero.

Verificación: tres pruebas PostgreSQL aislado de cancelación concurrente/repetida, reembolso total con envío, estado monetario pendiente de liquidar, carrera cancelación/envío, lote bloqueado y cancelación total pagada con puntos. Se ejecutan junto a las ocho pruebas de Stripe; build y diff check. Fixtures y proveedores sintéticos; sin cobros reales.

Pendiente para cerrar #25: validación con cuenta sandbox y navegador, producción/compra real #38, vinculación invitada verificada con crédito diferido y operación de reembolsos/posventa completos de #28. Ejecutores y recuperación de anomalías siguen coordinándose con #30/#41. La cancelación pública del intento de pago no equivale a la cancelación administrativa del pedido confirmado.
