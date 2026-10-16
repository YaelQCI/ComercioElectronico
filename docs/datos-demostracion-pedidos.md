# Clientes, pedidos y reseñas de demostración

La migración `20261016060000_demo_customers_orders_reviews` incorpora datos académicos asociados exclusivamente a artículos DEMO del catálogo inicial:

- Seis clientes: `Cliente DEMO 01` a `Cliente DEMO 06`, con correos del dominio reservado `demo.example.invalid`.
- Doce pedidos: `DEMO-PEDIDO-001` a `DEMO-PEDIDO-012`, cada uno con dos productos, dirección ficticia, líneas, unidades e historial.
- Ocho reseñas de demostración asociadas a unidades de los cuatro primeros pedidos entregados. Las estrellas varían entre tres y cinco. Otros pedidos entregados quedan sin reseñas.

| Estado inicial | Pedidos |
| --- | ---: |
| Entregado | 6 |
| Confirmado | 1 |
| En preparación | 2 |
| Enviado | 1 |
| Pendiente de pago | 2 |

Todos los nombres, números y textos identifican los registros como DEMO. Las reseñas dicen que son opiniones ficticias, y sus autores llevan DEMO en el nombre. El vínculo de compra entregada satisface las restricciones de la base, pero no acredita un testimonio comercial real.

## Pagos, inventario y envío

Los diez pedidos que avanzaron tienen una bonificación histórica de demostración del 100%: conservan precios de referencia, total cero y estado de dinero `NOT_REQUIRED` (No requerido). No se crea un cupón canjeable. Los dos pendientes conservan su importe y estado `PENDING`, sin reservar stock ni iniciar pago. No se crean intentos de Stripe, cobros, reembolsos o movimientos de puntos.

Los pedidos avanzados recorren los estados válidos, consumen una reserva y registran recepción, reserva y venta en lotes históricos dedicados. Cada lote termina con saldo y reserva cero; las 526 piezas del stock inicial permanecen disponibles. No se alteran existencias ni pedidos comerciales previos. Las cotizaciones usan la estructura admitida por el esquema, con transportista `DEMO`, servicio `SIN-ENVIO`, importe cero y snapshots marcados como demostración; no se consulta a Envia ni se generan guías. La dirección ficticia indica expresamente que no debe enviarse nada.

## Instalación y acceso

En el entorno Docker, el servicio `migrate` instala la nueva migración. Si no hay almacén, se crean los clientes y se difieren los pedidos y reseñas hasta configurar el primer almacén desde Administración. `initializeDemoHistory` invoca la función SQL versionada dentro de esa transacción, después de inicializar el stock de demostración.

Las cuentas no tienen contraseña utilizable y no se crean sesiones ni usuarios administradores. Sirven para explorar Administración → Usuarios y las relaciones de los pedidos. No se distribuye una contraseña común dentro de la migración.

Los pedidos se consultan en Administración → Pedidos; las reseñas aparecen en las fichas de proteína aislada vainilla, creatina frutos rojos, electrolitos limón, vitamina C y glutamina natural de demostración, según sus SKU iniciales. La edición o retiro posterior de un producto no se revierte al reiniciar.

Cada cliente se identifica por correo reservado y auditoría, y cada pedido por su número único. Una reejecución conserva ediciones, estados y moderación; no crea reseñas duplicadas ni vuelve a consumir inventario. No se adoptan cuentas existentes sin la marca de auditoría de inicialización.

## Verificación

`tests/database/demo-history.test.mjs` valida cantidades, estados, totales y bonificaciones, ausencia de pagos externos, movimientos de inventario compensados, vínculo de cada reseña con el mismo comprador y producto de un pedido entregado, consulta pública y conservación de cambios al reejecutar. Las pruebas se ejecutan en PostgreSQL temporal con sus restricciones y triggers activos.

Entrega verificada: compilación Docker y migración local correctas; 86 pruebas unitarias y 100 PostgreSQL aprobadas. Se confirmaron en la base local seis clientes, doce pedidos, ocho reseñas y las 526 piezas iniciales conservadas. La prueba de navegador del catálogo comprobó una reseña DEMO visible en la ficha de proteína aislada vainilla, además de stock, imágenes y ancho móvil en ambos temas. No se hicieron cobros, envíos ni pruebas que escribieran en carritos reales.
