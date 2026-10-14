# Demostración de venta real (#38)

Ruta elegida: venta real con Stripe. RFID queda fuera del alcance elegido. Este procedimiento prepara la evaluación; no autoriza ni acredita un cobro realizado. La integración actual está deshabilitada por defecto; seguir [Stripe](stripe-payments.md), [checkout](checkout.md) y [entrega técnica](technical-delivery.md).

## Preparación pendiente

El equipo y docente deben acordar fecha/procedimiento, producto real disponible, comprador, total final y condiciones de entrega/retorno. $10 MXN es propuesta, no precio comercial inventado: [Stripe documenta mínimo 10 MXN](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts), dependiente de moneda de liquidación y conversiones; verificar cuenta habilitada y total incluyendo envío/descuentos antes de la demostración. Nunca usar tarjeta de prueba en live ni capturar tarjeta en aplicación/logs.

Requiere catálogo/almacén/caja documentados, políticas/contacto aprobados, HTTPS y backend activo con PostgreSQL, cuenta Stripe live habilitada y secrets privados. Comprobar sandbox primero; separar base y claves test/live. Revisar condiciones de Stripe y obligaciones de la venta con los responsables del negocio; documentar consentimiento del comprador, comprobantes, privacidad y condiciones comerciales aplicables antes de ejecutar. No hay evaluación legal completada en este repositorio.

## Recorrido ejecutable

1. Registrar versión/commit local entregado, entorno HTTPS y aprobación de evaluación. Verificar `/api/health`, login, catálogo/stock y worker de reconciliación. No publicar valores de configuración.
2. Comprador elige producto acordado, agrega al carrito, completa dirección real y acepta cotización y políticas. Revisión del total final antes de crear sesión; ninguna guía de Envia.
3. Comprador realiza personalmente pago en Checkout Stripe de producción, usando su tarjeta y autenticación requerida. No mostrar tarjeta, claves, credencial invitado o correo/dirección en grabaciones.
4. Retorno consulta estado del servidor. Un redirect exitoso no prueba pago: esperar confirmación verificada del proveedor, pedido CONFIRMED y pago aplicado SUCCEEDED. Verificar consumo único de unidades/lotes y retiro de líneas compradas.
5. Ejecutar `node scripts/report-sale.mjs UUID_PEDIDO` en entorno privado configurado. Es solo lectura, emite correspondencia agregada sin PII ni identificador público de Stripe; salida 1 si no concuerdan registros. El informe siempre marca `livePaymentVerified:false`: una base sintética puede imitar estados, por lo que debe complementarse con comprobación privada en Dashboard live de la misma transacción/importe/moneda y demostración frente a docente.
6. Guardar evidencia anonimizada con fecha/commit, resultado local y confirmación de entorno live/docente. Video es complemento, no sustituto sin autorización docente. No publicar informe generado con información comercial sin revisión.

## Recuperación

Si pago pendiente/falla red, no repetir compra como supuesto remedio: consultar/reconciliar intento persistido. Webhook duplicado no vende dos veces; plazo local treinta minutos requiere worker que expira/reconsulta. No liberar recursos ante incertidumbre. Un cobro no aplicado se compensa desde refund autorizado, sin cambiar compra legítima. Cancelación de confirmados antes de envío crea reintegro persistido; no afirmar cancelación monetaria hasta SETTLED. Reembolso o compensación real requiere acción acordada con propietario/comprador y revisión de estado; el script de informe jamás lo ejecuta.

Pendiente: datos/cuenta/HTTPS/worker operativos, sandbox, acuerdo docente/comprador, venta real y evidencias. #38 debe permanecer abierto; ninguna prueba automática sustituye esos criterios.
