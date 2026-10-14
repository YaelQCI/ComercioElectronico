# Pagos con Stripe (#30)

Implementación del issue #30. Modalidad elegida: **Checkout alojado**, pago único en MXN, exclusivamente tarjetas de crédito/débito. El formulario de tarjeta pertenece a Stripe; no se almacenan PAN/CVC ni respuestas completas del proveedor. Cliente REST limitado a crear/consultar/cerrar sesiones y crear/consultar reembolsos, host fijo y API `2025-09-30.clover`. El checkout de Stripe recibe una línea por el importe final del pedido; el desglose comercial y los repartos por unidad permanecen en la tienda/PostgreSQL.

## Configuración y activación

La integración permanece deshabilitada por defecto. Configurar privadamente las variables de `.env.example`, sin modificar claves de un intento en curso:

| Variable | Uso |
| --- | --- |
| `NUXT_STRIPE_ENABLED` | `true` habilita endpoints/botón; valor inicial `false` |
| `NUXT_STRIPE_ENVIRONMENT` | `test` o `live`; debe coincidir con prefijo de clave y livemode de respuestas/eventos |
| `NUXT_STRIPE_SECRET_KEY` | Clave privada del entorno; nunca pública |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Secreto privado del endpoint; diferente por entorno |
| `NUXT_STRIPE_SITE_URL` | Origen de retorno, sin ruta/consulta; HTTPS en live, localhost HTTP admitido solo en test |
| `NUXT_STRIPE_MINIMUM_CENTS` | Mínimo configurado para la cuenta/moneda de liquidación, inicialmente `1000` centavos MXN |

La [documentación de monedas](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts) enumera $10 MXN para liquidación en MXN; verificar las condiciones de la cuenta si hay conversión. No redondear ni agregar cargos cuando un importe positivo no alcance el mínimo. La clave publicable heredada no es necesaria para redirigir al Checkout alojado.

Antes de habilitar: cuenta sandbox, catálogo/políticas/almacén/cajas reales aprobados, Envia únicamente para cotizar, origen propio, webhook y ejecutor de reconciliación funcionando. Registrar POST `/api/payments/stripe/webhook` con eventos `checkout.session.completed`, `checkout.session.expired` y `payment_intent.payment_failed`, y versión de API compatible. Nunca copiar claves live a pruebas aisladas. Esta implementación no crea cuentas Stripe, configura su Dashboard ni ejecuta una compra real.

## Flujo y límites transaccionales

1. #24 prepara pedido y sus snapshots sin cobro/reserva. Si Stripe está habilitado, muestra “Ir a pagar con Stripe”.
2. Inicio autorizado por cuenta, cookie opaca de carrito invitado o credencial opaca del pedido. Correo/número/UUID público no autorizan. Revalidación de carrito, selecciones, precios, políticas, caja y origen; recotización Envia fuera de transacción. Cambio de tarifa/cobertura exige volver al carrito y aceptar/preparar de nuevo, incluso si envío es gratis.
3. Transacción corta: bloqueo del pedido/carrito, nueva comprobación de huella, instantánea de tarifa recién consultada, reserva conjunta FEFO/cupón/puntos por 30 minutos, intento y outbox CREATE_PAYMENT. Un segundo inicio reutiliza la misma reserva/intento. Las llamadas Stripe ocurren después del commit.
4. Creación con clave idempotente estable; petición deriva del pedido, no del importe del navegador. La cantidad enviada por el cliente solo comprueba que aceptó el total. Se conserva huella de clave/configuración/origen/entorno para impedir crear otro pago al cambiar de cuenta o configuración durante un intento. Referencias Session/PaymentIntent se persisten sin hacer retroceder un webhook que ganó la carrera.
5. Webhook verifica HMAC sobre bytes originales, timestamp con tolerancia de cinco minutos y entorno; inbox persistente deduplica por ID/digest. Se consulta la sesión real antes de confirmar; validar pedido/intento/importe/moneda. Firma válida por sí sola no autoriza consumir un pedido diferente.
6. Confirmación transaccional única: marcar pago aplicado, consumir cupón/puntos/FEFO, historial y estado CONFIRMED/PAID; retirar solo IDs/cantidades comprados del carrito y conservar añadidos posteriores. Puntos ganados siguen acreditándose al entregar (#26), no al cobrar. Total cero confirma internamente con NOT_REQUIRED y sin crear Session/PaymentIntent.

`/pago?pedido=...` consulta el servidor y ofrece actualizar, reanudar o cerrar un intento pendiente. La query de retorno no confirma pago. Invitado conserva credencial en cookie HttpOnly/Secure/SameSite Lax para volver desde Stripe; no se escribe en localStorage ni en URLs de Stripe. Mutaciones/consultas privadas requieren Origin propio y respuestas exitosas son no-store; errores estándar Nitro usan no-cache. Stripe webhook usa su firma, no Origin del navegador.

## Expiración y recuperación

Stripe admite expiración nativa entre [30 minutos y 24 horas](https://docs.stripe.com/api/checkout/sessions/create). Se solicita 31 minutos desde la reserva para admitir latencia de creación; **el plazo local sigue siendo 30 minutos**. El ejecutor debe cerrar explícitamente la sesión al vencer el plazo local y consultar su resultado antes de liberar. Este margen no amplía el plazo del cliente. Si la creación no llegó a Stripe y el reintento ya no satisface la expiración mínima, se conserva para revisión; nunca inventar una sesión ni liberar por ausencia de webhook.

```powershell
# Solo conteos, sin red Stripe ni modificaciones:
node scripts/reconcile-payments.mjs
# Tras configurar el entorno autorizado, consultar/cerrar/recuperar intentos:
node scripts/reconcile-payments.mjs --apply
```

Programar el comando periódicamente en #41, con supervisión, límites de tiempo y alertas. Procesa hasta veinte intentos por vuelta, ordenados por última consulta para no bloquear indefinidamente a otros pedidos. Timeout/resultado incierto conserva recursos y marca reconciliación. Cerrar desde la interfaz tampoco afirma impago: consultar/cerrar/consultar proveedor antes de liberar. Pago observado o evento firmado dentro del plazo puede confirmar aunque el webhook llegue después; si falta prueba de tiempo suficiente, requiere revisión. No reaplicar estados expirados a una compra ya confirmada.

Cobro válido pero no aplicado a una reserva liberada/compra ya confirmada, o cobro probado fuera del plazo: registrar pago exitoso no aplicado y solicitud COMPENSATION con techo de ese PaymentAttempt, solo dinero, sin asignaciones comerciales ni alteraciones a inventario/puntos/pago legítimo. Ejecución de reintegro por herramienta administrativa. Desajustes de importe/moneda, cobros sin referencias y reservas retenidas tras incidencias de lote/saldo siguen requiriendo recuperación operativa; no existe resolución automática universal de anomalías.

## Reembolsos autorizados

POST `/api/admin/payments/refunds/:id` revalida ADMIN y ejecuta una solicitud persistida, nunca acepta importe/PaymentIntent del navegador. Cancelación debe estar registrada antes de envío; devolución requiere recepción/inspección; Price Match exige aprobación. #28 debe producir solicitudes/asignaciones y gestionar inspección/restauración de stock; este endpoint no las inventa.

Importes pendientes y pertenencia/techos protegidos por SQL existente. Outbox y clave estable, llamadas fuera de transacción, estado PROCESSING mientras no haya éxito. Una respuesta pendiente conserva providerRefundId; siguiente ejecución consulta ese reintegro, evitando interpretar el resultado cacheado del POST idempotente como estado actual. Éxito sincroniza dinero y restituye canje/revierte ganancias una vez por reparto original, admitiendo deuda. COMPENSATION nunca consume techo del cobro aplicado ni modifica beneficios. Un fallo terminal necesita una nueva decisión comercial; no se elimina historial.

## Evidencia y criterios pendientes

Pruebas nuevas: cinco de cliente/firma y ocho PostgreSQL con catálogo, políticas, tarifas y Stripe **sintéticos**, todas aprobadas. Incluyen inicio concurrente, acceso ajeno, webhooks repetidos, importe/tarifa alterados, rechazo de tarjeta, proveedor incierto/recuperación, expiración/reintento, carrito añadido después, total cero, canje, reembolso/reversión y compensación separada del cobro legítimo. También pasaron pruebas de inventario/cupones/puntos/precios relacionadas: 18 de BD y 15 de cliente/precios en total. `npm run test:payments` reproduce las cinco pruebas sin credenciales; las de BD requieren `TEST_DATABASE_URL` aislada. Sesiones PostgreSQL de pruebas/servidor usan UTC; no se modificó `.env`, la BD comercial ni migraciones anteriores. No hizo falta cambio de esquema.

Build Nuxt y prueba HTTP del build: Origin ajeno, propiedad, no-store, firma real sobre bytes originales, deduplicación y `/pago` SSR; sin llamadas reales Stripe. La respuesta SSR no acredita interacción/inspección visual. Se observa una advertencia de deprecación de pg sobre consultas concurrentes del adaptador; las pruebas pasan con pg 8 fijado, sin afirmar compatibilidad con pg 9.

**Para cerrar #30 faltan:** cuenta/credenciales y prueba contractual sandbox (aprobación/rechazo/3DS/expiración/reembolso), validación de interacción y redirecciones con navegador/Stripe real, ejecutores/alertas y recuperación operativa completa de anomalías, flujo aprobado de solicitudes de posventa y restitución de stock (#25/#28), canje/direcciones de interfaz (#24), y configuración HTTPS/live con compra real/evidencia #38. No se habilitó live ni se efectuaron cobros/reembolsos reales. El issue debe permanecer abierto.

Fuentes oficiales: [Checkout](https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-09-30.clover), [webhooks](https://docs.stripe.com/webhooks), [consulta/cierre de sesiones](https://docs.stripe.com/api/checkout/sessions/expire), [reembolsos](https://docs.stripe.com/api/refunds/create).
