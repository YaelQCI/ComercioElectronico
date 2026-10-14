# Preparación de evaluación técnica individual (#40)

Este recorrido es material de práctica. No demuestra comprensión individual ni registra ensayos no realizados. Cada integrante debe ejecutarlo y explicar con sus palabras; la evaluación requiere aplicación funcionando, no solo diapositivas. Consultar [entrega técnica](technical-delivery.md), [arquitectura](architecture.md), [modelo](modelo-base-de-datos.md) y [venta real elegida](real-sale-demonstration.md).

## Recorrido individual reproducible

Arrancar conforme README con base propia y catálogo aprobado; en práctica aislada usar datos sintéticos identificados y Stripe test, nunca presentarlos como ventas reales. Registrar commit y entorno sin claves. Abrir inicio/catálogo, buscar SKU y combinar filtros, elegir presentación e imagen, revisar lote y precio por porción, agregar, editar cantidad, aplicar cupón inválido y explicar respuesta. Completar dirección/cotización, revisar total y demostrar un pago sandbox con webhook confirmado; explicar por qué redirect no confirma cobro. Mostrar pedido, transición administrativa y movimientos de inventario. La compra live #38 requiere condiciones acordadas y la ejecuta el comprador.

## Preguntas con referencias comprobables

|Tema|Qué debe explicar cada integrante|Dónde comprobarlo|
|---|---|---|
|Arquitectura|Página/API delegan al dominio; reglas puras; Prisma encapsulado|app/features, server/features, shared/features, AGENTS.md|
|SSR/datos|Nuxt ejecuta servidor; navegador no consulta PostgreSQL; URL controla búsqueda|server/api/catalog, módulo catálogo y pruebas catalog-search|
|Relaciones|Product→Variant→Lot; Order→Line→Component→Unit; pertenencia y snapshots|schema.prisma y migración inicial|
|Autenticación|Hash de contraseña, JWT corto, sesión revocable, cookies; rol validado en servidor|accounts/credentials.js, account-http.js, authorization.js|
|Concurrencia|Versión carrito; bloqueo reserva y FEFO; no sobreventa; idempotencia|cart, inventory, payments y tests/database|
|Stripe|Tarjeta alojada; firma cuerpo original; consulta proveedor; reserva incierta y compensación|stripe-client.js, stripe-events.js, order-payments.js|
|Dinero/puntos|Centavos y décimas; reparto estable; reserva reintegros; puntos negativos|shared/features/pricing, loyalty, after-sales|
|Seguridad|Origen, autenticación/autorización, límites; errores sin secretos|security.md y tests/database/security.test.mjs|
|Diseño|Azul/amarillo, contraste, foco, 44px, movimiento reducido, estados reales|tokens.css, acceptance-audit.md, interactions.md|
|Autoría|Código propio vs Nuxt/Vue/Prisma/Tailwind; cliente generado y artefactos excluidos|package.json, lockfile, .gitignore, historial Git|

## Práctica de modificación y diagnóstico

En una rama local de práctica sobre base aislada, cambiar el texto de éxito de carrito en `app/features/cart/useCart.js`, comprobar con navegador que se anuncia y que no rompe flujos; build y diff para explicar el cambio. Es un ejercicio propuesto: no se aplica automáticamente a la versión entregada. Descartar solo cambios propios de esa rama después de registrar evidencia, sin reset de base.

Diagnóstico propuesto: configurar temporalmente un puerto PostgreSQL inaccesible exclusivamente en el proceso de práctica; observar `/api/health` 503 y error controlado, explicar diferencia entre configuración/red/autenticación/migración. Restituir variable y verificar salud/lectura. No editar .env compartido, secretos ni detener bases existentes. Otro caso: cupón inválido mantiene carrito y muestra error; revisar API y prueba correspondiente antes de culpar a interfaz.

Para cada ensayo registrar integrante/fecha/commit/entorno, recorrido ejecutado, respuestas explicadas sin asistencia, cambio/diff propio, falla diagnosticada, resultados y temas por reforzar. Las contribuciones deben estar confirmadas por el equipo y contrastadas con `git log`; no adjudicar autoría a personas sin evidencia.

## Limitaciones que deben poder justificar

Catálogo comercial, políticas, verificación por correo/vinculación invitada y operación AWS siguen pendientes. Pago simulado no satisface venta real; video no sustituye demostración sin permiso docente. Auditoría actual conserva desbordamiento de 2px a 1100px y escenarios faltantes de posventa. Administración puede ser mediante herramientas/API según #1, pero debe demostrarse con permisos reales. Envia es solo cotizaciones. Falta medir rendimiento y practicar individualmente con sistema final.

Para cerrar #40 faltan integrantes/contribuciones confirmadas y registro de prácticas y comprensión de cada uno; este guion no acredita esos hechos.
