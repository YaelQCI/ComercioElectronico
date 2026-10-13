# Inventario y reservas · #13

Reglas puras FEFO/demanda en `shared/features/inventory/`; casos de uso Prisma en `server/features/inventory/`. No hay endpoint público de reserva ni ajustes sin autenticación. Agregar al carrito no invoca reserva.

Usar `withInventoryTransaction(database, async context => { ... })` y pasar context a reserveInventory/consumeInventory/releaseInventory/adjustInventory. El contexto incluye tx para coordinar pedido, cupón y puntos dentro de la misma transacción. No se acepta cliente Prisma directo como sustituto de transacción. Los triggers diferidos de #33 impiden resolver una reserva sin resolver todos los recursos asociados.

- Reserva deriva demanda de OrderUnit, incluyendo componentes de combos; bloquea pedido/reserva, productos por ID, variantes por ID y lotes por variante/FEFO, con orden consistente entre operaciones. Revalida publicación, variante, marca, fecha local/stock después de adquirir bloqueos. Asigna varios lotes cuando hace falta, guarda snapshot por unidad y registra RESERVE por lote.
- Reserva debe estar ACTIVE, pedido PENDING_PAYMENT y plazo vigente. El modelo impone máximo 30 minutos desde creación; checkout #24 creará ese plazo. Rerun del mismo intento no duplica RESERVE ni extiende expiración.
- Consumo registra SALE por unidad una sola vez y resuelve CONSUMED. Total cero no requiere Stripe, pero debe seguir vigente. Para importe positivo exige intento SUCCEEDED, monto/moneda correctos y providerPaidAt dentro del plazo; pago tardío o lote inválido requiere reconciliación. Confirmación completa del pedido/recursos corresponde a #24/#30.
- Liberación deduplicada registra RELEASE y resuelve RELEASED; con intentos de pago exige FAILED/EXPIRED y lastReconciledAt. Nunca libera solo porque transcurrió el plazo cuando Stripe sigue pendiente. Worker/reconciliación del proveedor quedan pendientes de #30/#41.
- Ajuste exige admin activo, delta entero con signo, motivo y clave de idempotencia. Bloquea lote, impide retirar piezas reservadas y registra responsable/fecha en el ledger. No cambia contadores directamente.

## Corrección de instantes

Las pruebas detectaron que el adaptador instalado normaliza timestamptz sustituyendo el offset por +00:00, sin convertir el instante; además entradas sin offset dependen de la sesión. En la base local con zona de México se reprodujo una diferencia de seis horas. Se fijó `options: '-c timezone=UTC'` por conexión en aplicación, CLI y clientes Prisma de pruebas. La zona comercial del almacén sigue aplicándose para caducidad. No se cambió la configuración global de PostgreSQL ni migraciones aplicadas.

Referencia de comportamiento reportado: [issue oficial Prisma](https://github.com/prisma/orm/issues/26786); soporte de opciones de conexión: [node-postgres](https://node-postgres.com/apis/client). La corrección se verificó localmente con epoch PostgreSQL, no se asumió resuelta por una versión futura. Los registros previos afectados eran fixtures sintéticas; no se corrigió ni modificó una base comercial.

Pruebas reales PostgreSQL aislado: reloj/epoch UTC, carrera por última pieza (solo una reserva), reserva/consumo de importe cero sin duplicados, asignación/snapshot por unidad, vencimiento, bloqueo de liberación por pago pendiente y ajuste admin/idempotente que respeta piezas reservadas. Fixtures sintéticas, sin llamadas a Stripe ni cobros.

Suite completa de base de datos: 26 pruebas correctas. Los archivos se ejecutan secuencialmente para no mezclar fixtures en los conteos compartidos; las carreras de inventario dentro de sus pruebas siguen usando transacciones simultáneas. No se eliminaron fixtures previas ni se reseteó la base comercial.

Pendiente para completar #13: checkout/autenticación y revalidación del carrito; reserva de cupón/puntos y confirmación completa; worker Stripe/expiración; restitución por cancelación y recepción/inspección de devoluciones; datos reales y pruebas de ciclo comercial completo. Estas funciones no se declaran terminadas ni se habilita compra todavía.
