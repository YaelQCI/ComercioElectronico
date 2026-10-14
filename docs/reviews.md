# Reseñas verificadas (#21)

Ficha de producto incorpora consulta paginada de diez reseñas, promedio/distribución calculados solo sobre visibles, estados de carga/vacío/error y formulario de alta/edición propia. Las variantes comparten reseñas del padre. Solo una cuenta activa con unidad de ese producto en pedido DELIVERED y vinculado puede publicar; incluye componentes de combos. La comprobación se hace en servidor y la restricción SQL existente verifica pertenencia. Compra verificada no depende de una casilla enviada por cliente.

Edición serializada por usuario, unicidad `(userId, productId)`, texto de hasta 4000 caracteres, título hasta 120 y calificación entera 1–5. Publicación inicial directa. Edición conserva hiddenAt; no elude moderación. Contenido se interpola como texto, sin HTML ejecutable. Cuenta desactivada aparece como tal en el autor público. No se publican IDs de usuario, correo, unidad ni pedido en la consulta pública.

API: GET/POST `/api/reviews/products/:id`, GET `/api/reviews/products/:id/mine`, POST `/api/reviews/:id/moderation` con `{action: 'HIDE'|'RESTORE', reason}`. Moderación revalida ADMIN activo en transacción, bloquea reseña y registra motivo/fecha/administrador en historial inmutable, sin editar texto/calificación. Puede operarse con herramientas HTTP de administración autenticada; no hay dashboard. Mutaciones exigen Origin propio y límite por usuario.

Verificación: tres pruebas en PostgreSQL aislado con pedido sintético total cero entregado y todas las restricciones activas: autor sin compra rechazado, alta/edición única, promedio/distribución, moderación ajena rechazada, ocultación/restauración auditadas, edición sin desocultar, campos inválidos y compra de componente en combo. Build y diff check correctos. La fixture no crea pagos ni ventas reales.

Pendiente para cerrar: recorrido visual/teclado/tacto de consulta, paginación y formulario; verificación/vinculación de compras invitadas depende de #23 y demostración con flujo real de entrega de #35. La implementación de reseñas no habilita pedidos o correo que aún faltan.
