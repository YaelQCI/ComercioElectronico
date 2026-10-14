# Entrega técnica y evidencias por parcial (#39)

Versión de trabajo del 14 de octubre de 2026. Documenta el código local y sus límites; no constituye entrega final aprobada. Los commits permanecen locales por instrucción del propietario. Los documentos originales del curso se referencian por las transcripciones de los issues; no se declara haber validado archivos ausentes.

## Negocio, tecnologías y diseño

[Propuesta B2C y mercado meta](business-proposal.md), [arquitectura por capacidades](architecture.md), [modelo físico](modelo-base-de-datos.md) y [decisiones del modelo](decisiones-base-de-datos.md). Stack y pasos ejecutables: [README](../README.md). Azul/amarillo y tipografías conservan identidad del prototipo; [tokens y contraste](design-tokens.md), [tema](theme-preference.md) e [interacciones](interactions.md) documentan ajustes para legibilidad, foco y movimiento reducido.

## Flujo de datos y seguridad

El navegador llama API Nuxt; las entradas delegan casos de uso; PostgreSQL solo se accede desde servidor. Registro/login verifican credenciales y emiten sesión; perfil opera únicamente sobre identidad autenticada ([cuentas](accounts.md)). Búsqueda interpreta URL y aplica filtros/paginación en servidor ([búsqueda](catalog-search.md), [filtros](catalog-filters.md)). Carrito persiste bajo identidad de visitante y versión optimista ([adición](cart-addition.md), [edición](cart-editing.md)). Checkout guarda dirección y snapshots inmutables de artículos/componentes/unidades/costos/políticas ([checkout](checkout.md)).

Inicio de pago recotiza, exige total aceptado y reserva inventario FEFO/cupón/puntos en transacción. Stripe alojado recibe total; webhook firmado e inbox deduplicado consultan proveedor. Solo confirmación válida consume recursos y retira las líneas compradas del carrito; duda conserva reservas. [Ciclo de pago](payment-lifecycle.md), [Stripe](stripe-payments.md) y [reservas](inventory-reservations.md) detallan recuperación. Cero dinero confirma localmente sin crear cobro. Devoluciones/Price Match reservan repartos originales por unidad, inspeccionan stock y no resuelven reintegros inciertos ([posventa](after-sales.md), [puntos](loyalty.md)).

Administración exige rol activo en servidor, bloqueo transaccional, historial y auditoría; no se confía en controles visuales ([administración](administration.md), [pedidos](orders.md)). [Seguridad](security.md) describe credenciales, origen, límites y pendientes. Secrets solo privados; nunca registrar claves, cookies o cuerpos comerciales en evidencias públicas. Integraciones Envia exclusivamente cotización ([contrato](envia-quotes.md)); ningún flujo emite guías.

## Instalación, migraciones y pruebas

Seguir README: Node24.12, npm ci, configurar .env privado, levantar PostgreSQL propio, `npm run db:deploy`, generar/importar datos documentados, build y start. El arranque no aplica migraciones. [Migraciones](database-migrations.md) registra primera migración integral y posteriores; nunca reset ni edición de SQL aplicado. El catálogo comercial aún necesita datos aprobados: [importador](catalog-import.md). No utilizar fixtures sintéticos como productos reales.

Pruebas unitarias: `node --test tests/catalog/*.test.mjs tests/pricing/*.test.mjs tests/payments/*.test.mjs tests/accounts/*.test.mjs tests/appearance/*.test.mjs`. Integración: TEST_DATABASE_URL debe apuntar a fitness_migration_test* y `npm run test:database`; contiene escrituras sintéticas. Browser/contraste y resultados del 14 de octubre: [auditoría](acceptance-audit.md). La salida generada/cliente Prisma/.output/node_modules no se versiona ni cuenta como código propio. Nuxt/Vue/Tailwind/Prisma/pg y fuentes son dependencias; código de dominios, API, vistas, scripts y SQL versionado pertenece a la implementación del proyecto. No se inventan contribuciones individuales: autoría comprobable en Git; reparto del equipo debe ser confirmado por sus integrantes.

## Evidencias por parcial

|Parcial|Material versionado|Evidencia todavía requerida|
|---|---|---|
|P1: propuesta, arquitectura, UI/prototipo|#31/#32, references, tokens/componentes, modelo revisado #33|Fuentes originales y exposición del equipo, decisiones validadas|
|P2: persistencia, usuarios, CRUD, carrito, checkout|Migraciones #33/#43, pruebas PostgreSQL, cuentas #23, administración #34, carrito #14–#20, checkout #24|Capturas y recorrido browser con diez productos aprobados; CRUD visual y persistencia tras reinicio final|
|P3: integración/demostración|Pagos #30, cancelación #25, pedidos #35, puntos #26, posventa #28; scripts y tests|Stripe sandbox, venta real obligatoria #38, operación AWS/DNS #41, grabación final y estado consistente|

La ruta elegida es venta real con Stripe; RFID queda fuera del alcance actual. No existe demostración real ejecutada en este checkout. El [procedimiento de venta real](real-sale-demonstration.md) prepara #38; pruebas simuladas no lo sustituyen. Documentar compra real, trazabilidad pedido/pago/inventario y evidencia anonimizada antes de afirmar cumplimiento.

## Limitaciones, desarrollo y mejoras

Se adapta la base por dominio sin reorganizaciones ajenas al issue. Cada implementación tiene commit local, pruebas pertinentes y comentario con pendientes. El archivo [AGENTS.md](../AGENTS.md) conserva reglas del propietario. Documentos históricos identifican su fecha; una afirmación antigua de capacidad pendiente no sustituye la evidencia actual de su módulo.

Faltan catálogo/almacén/cajas/certificados aprobados; proveedor de correo para verificación/vinculación y reposición; aprobación de políticas/contacto; consola administrativa; pruebas posventa de combos/lotes; auditoría visual/seguridad final; AWS/Route53, operación y venta real. Priorizar por dependencias y registrar evidencia por commit. No declarar coincidencia entre políticas publicadas y cálculos mientras políticas reales no estén aprobadas. Los avances aquí documentados mantienen #39 abierto hasta anexar esas evidencias y confirmar contribuciones.
