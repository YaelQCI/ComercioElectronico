# Primera migración de negocio · #33

## Resultado y alcance

`prisma/schema.prisma` traduce las **57 tablas y 35 enums** del diccionario publicado en #33. `prisma/migrations/20261013170000_initial_business_model/migration.sql` crea el modelo completo, no tablas comerciales temporales. La copia del issue utilizada está en `docs/database-model-source.md`.

El esquema cubre cuentas/sesiones, catálogo, variantes, medios, combos, inventario, carrito, cotizaciones, pedidos/unidades, reservas, cupones, pagos, puntos, devoluciones, Price Match, reseñas, reposición, outbox y auditoría. Preparar esta migración no completa los módulos funcionales ni todos los escenarios del issue #33.

Convenciones: UUID generados por Prisma en servidor; tiempos `timestamptz(3)` y fechas de lote `date`; dinero y décimas de punto `BIGINT`; contenido/porciones decimal exacto. JSON únicamente para contenido flexible y snapshots. PostgreSQL no recibe datos de tarjeta ni tokens en claro como columnas del modelo. Correo se normaliza con trim y lowercase, sin quitar puntos ni etiquetas `+`; sabor/presentación usan la misma normalización para su unicidad. La validación de credenciales y hashes corresponde al servicio de autenticación.

## Decisiones físicas y restricciones

- Unicidad global de correos, SKU, códigos, slugs y hashes incluso con soft delete.
- FK históricas `RESTRICT`; solo el enlace opcional de dirección fuente usa `SET NULL`, conservando el snapshot.
- Columnas redundantes `orderId`, `variantId` y `userId` permiten FK compuestas: componente/línea/unidad; lote/variante; pago/reserva; devoluciones y Price Match/unidad/pedido; reembolso/pago/solicitud/unidad; cuenta de puntos/comprador. Impiden mezclar identificadores válidos de agregados distintos.
- CHECK de cantidades, dimensiones, contadores, precios, importes, monedas MXN, dirección mexicana, caducidad/precisión, campos excluyentes y sumas monetarias. Un almacén y configuración de tienda singleton.
- Índices parciales: dirección predeterminada, categoría principal, carrito activo, artículo/estado, reserva retenida, cupón consumido, pago aplicado, devolución activa, aviso de reposición y ganancia única por pedido.
- Índices de consulta para FEFO, catálogo, sesiones, pedidos, ledgers, reservas, inbox/outbox y posventa.
- Historial append-only en inventario, puntos, transiciones, auditoría y moderación. Ajustes administrativos y configuración requieren un usuario administrador activo.
- Los contadores de lote se actualizan **automáticamente al insertar un InventoryMovement**; no actualizarlos de nuevo en los servicios. La actualización bloquea el lote, verifica límites e impide saldo reservado superior al físico. Venta: un movimiento por unidad; recepción y reservas: demanda agrupada por lote. Claves e índices evitan repetir ventas, reservas, liberaciones y reposiciones.
- Balance de puntos se proyecta automáticamente desde su ledger; reserva de puntos incrementa/decrementa `reservedTenths`. No escribir contadores directamente ni repetir la actualización en la aplicación. Saldo negativo legítimo no implica puntos disponibles para nuevos canjes.
- Triggers diferidos permiten insertar un agregado completo dentro de una transacción, pero rechazan sumas inconsistentes al cerrarla. Confirmación exige dirección, paquete, lotes, recursos consumidos y pago aplicado o `NOT_REQUIRED` si total cero. Las transiciones requieren historial y los snapshots confirmados quedan protegidos.
- Reembolsos bloquean el pedido, verifican asignaciones y capacidad por unidad/medio/envío, incluyendo importes comprometidos. Compensación usa únicamente su propio cobro no aplicado, sin asignaciones comerciales. Las asignaciones e importes solicitados son inmutables; un fallo se registra, no se borra.
- Reseña requiere unidad comprada por ese usuario de ese producto y pedido entregado.
- Categorías sin ciclos, incluidas modificaciones concurrentes mediante bloqueo asesor transaccional.

La migración no genera guías, envíos ni recolecciones Envia: solo existe la estructura de cotizaciones y snapshots. No ejecuta Stripe, AWS ni correo.

## Procedimiento de aplicación

Revisar `DATABASE_URL` antes de ejecutar. Para una base **vacía y propia**:

```powershell
npm.cmd ci
npm.cmd run db:validate
npm.cmd run db:deploy
npm.cmd run db:check
```

`db:deploy` aplica el SQL versionado y registra su checksum en `_prisma_migrations`. No modifica una base ya existente para hacerla coincidir por fuerza. Si contiene tablas sin historial, preparar un baseline revisado, no aplicar esta inicialización encima.

Para cambios futuros, en base aislada de desarrollo: editar esquema, `npm run db:migration:create -- --name nombre_del_cambio`, revisar SQL (incluyendo triggers/restricciones), aplicar `npm run db:migrate`, generar cliente y versionar ambos archivos. En despliegue usar `db:deploy`; nunca resets ni `db push`. Los CHECK y triggers no se expresan en Prisma y deben conservarse al revisar cada migración. [Flujo oficial para SQL adicional](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).

## Pruebas

Se requiere una base exclusiva cuyo nombre comience por `fitness_migration_test`, ya migrada. La suite crea fixtures **sintéticas y explícitas**, no catálogo real. La prueba concurrente conserva registros en esa base; no ejecutar sobre datos comerciales.

```powershell
$env:TEST_DATABASE_URL='postgresql://usuario:password@localhost:55433/fitness_migration_test'
npm.cmd run test:database
```

No usa `DATABASE_URL` como fallback, no borra bases ni resetea migraciones. El pool y Prisma se desconectan al terminar. La suite comprueba tablas, lectura/escritura Prisma, unicidad tras soft delete, importes inválidos, propietarios excluyentes, jerarquía, contadores/ledgers, FK cruzadas, plazos, reservas, reseñas, reembolsos/compensaciones, carrera por última pieza, confirmación local de total cero y snapshots.

## Pendientes de #33 y coordinación

- Semilla comercial idempotente con al menos 10 productos distintos y datos documentados; datos reales de almacén/cajas, pesos/dimensiones y certificados. `db:seed` continúa fallando explícitamente en vez de inventarlos.
- Servicios Nuxt autorizados para catálogo/administración, cuenta, carrito y checkout. No se expone una API pública de escritura sin autenticación. El endpoint de salud sí utiliza el nuevo cliente.
- Flujos completos de JWT/verificación, FEFO, agregación combo + unidades, cupones, reparto por mayores restos, reconciliación Stripe, reembolsos, envío, avisos y trabajadores inbox/outbox.
- Pruebas de concurrencia de todos los flujos (no solo stock) y conciliación de ledgers. Antes de esperar red, confirmar la transacción corta y usar outbox; adquirir trabajo con bloqueo/lease, conservar claves de idempotencia y reintentar conflictos serializables de forma acotada.
- Conexión del entorno habitual de desarrollo (Docker o base propia) y validación en PostgreSQL 17.7 del Compose. Esta ronda utilizó el binario **PostgreSQL 18.1** disponible en el equipo, con un clúster aislado ligado a localhost en puerto 55433, sin tocar el servicio del puerto 5432.

## Respaldo y restauración

Usar herramientas compatibles con la versión del servidor. Guardar respaldos fuera de Git, en almacenamiento protegido. Ejemplo con variables de entorno locales (no poner credenciales en commits/logs):

```powershell
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file=backup.dump
# Crear por separado una base vacía de restauración; verificar el destino.
pg_restore --dbname="$env:RESTORE_DATABASE_URL" --no-owner backup.dump
```

Verificar historial de migraciones, conteos, FK, triggers y lectura de snapshots tras restaurar; no limitarse al código de salida. En producción, definir retención, cifrado y ensayo de recuperación en #41. El usuario de aplicación no debe ser superusuario ni poder deshabilitar triggers; configurar roles/privilegios en el despliegue.

## Evidencia ejecutada · 13 de octubre de 2026

- PostgreSQL 18.1 aislado, puerto 55433, directorio `.local-db/issue33` ignorado por Git. No se modificó el PostgreSQL existente del puerto 5432 ni `.env`.
- Migración final aplicada con `prisma migrate deploy` sobre base vacía `fitness_migration_test_final`; 57 tablas y 35 enums. SQL dentro de `BEGIN/COMMIT` para aplicación atómica.
- `prisma validate` y generación del cliente correctas; build Nuxt correcto.
- **16 pruebas de integración correctas**, incluida escritura/lectura Prisma, última pieza concurrente, FK cruzadas, límites de reembolso y confirmación local de total cero.
- `pg_dump` custom y `pg_restore` en una base vacía distinta: conteos/digests de registros, restricciones y triggers coinciden; las 16 pruebas también pasan en la restauración. `tests/database/backup-report.mjs` normaliza únicamente los paréntesis redundantes del CHECK de rating compuesto solo por AND, que pg_dump aplana; las demás definiciones se comparan exactamente.
- Tras detener y arrancar el clúster aislado, registros e invariantes permanecen iguales.
- `/api/health` del build Nuxt conectado a la base migrada: **HTTP 200**, `{"status":"ok"}`.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: **sin diferencias**. Prisma no verifica el significado de los triggers; por eso existen las pruebas PostgreSQL.
- `git diff --check`: correcto. Servidor de comprobación y clúster aislado detenidos al terminar.

El SQL inicial se revisó y refinó en bases de prueba nuevas durante su preparación; aún no se ha aplicado en un entorno compartido ni subido a GitHub. A partir de su adopción, cualquier cambio debe usar una migración nueva.
