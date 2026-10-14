# Puntos (#26)

Dinero y décimas se calculan con BigInt. Ganancia: floor(dinero elegible retenido de productos / 1000 centavos) × 10 décimas; excluir envío y parte canjeada. Método puro contempla reembolsos de dinero de productos ya asentados. Lectura de cuenta muestra saldo contable (puede ser negativo), reservado/disponible y movimientos paginados, sin inventar puntos.

Al avanzar pedido a DELIVERED, #35 acredita en la misma transacción mediante clave única earn:pedido. Sin cuenta vinculada o cuenta desactivada se difiere; vinculación verificada deberá invocar el mismo caso de uso. Ganancia cero también registra procesamiento idempotente. Historial/proyecciones se mantienen mediante triggers existentes; no se escriben saldos directamente.

reservePoints/consumePoints/releasePoints requieren contexto transaccional de inventario y bloquean pedido/reserva/cuenta. Reservar solo durante ventana activa, por importe de snapshot y hasta productos/saldo libre. Consumir exige pago verificado dentro del plazo o total cero sin intento Stripe; liberar exige todos los intentos reconciliados definitivamente sin pago. Canje consume una vez mediante ledger, reserva libera una vez, saldo insuficiente frente a reservas bloquea confirmación para reconciliar. No hay endpoint público para acreditar arbitrariamente.

Verificación: regla de redondeo/centavos y cantidades superiores a Number seguro; dos pruebas PostgreSQL aislado de canje concurrente, liberación/consumo idempotentes total cero, crédito único tras entrega y saldo negativo. Prueba de pedidos verifica integración de entrega; build/diff check. No se atribuyen saldos sintéticos a compradores reales.

Pendiente para cerrar: selector/canje conectado a checkout, vinculación por correo verificado, restitución/reversión por cancelación/devolución/Price Match con reparto original, conciliación de canjes ante deuda y demostración visual/flujo completo. Las funciones internas no completan solas esos criterios.
