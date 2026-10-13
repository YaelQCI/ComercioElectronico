# Importación de catálogo · #3

El propietario confirmó que aún no existen datos comerciales definitivos. No se importaron los precios, inventarios, lotes ni afirmaciones del prototipo como datos reales. El mínimo académico de diez productos distintos sigue pendiente.

El módulo `server/features/catalog/` valida manifiestos y coordina una importación atómica mediante Prisma. Las reglas de formato son independientes de Nuxt y de Prisma. No hay un endpoint público de importación; la herramienta es local para datos revisados.

## Uso

1. Preparar un JSON con `version: 1` y una lista `products`. Cada producto incluye `slug`, `name`, `description`, `categories` (slug/name), `images` y `variants`. `brand` (slug/name), `goals`, `disciplines`, `ingredients`, `usageInstructions` y `allergenInformation` pueden añadirse cuando estén documentados. El producto es borrador por defecto; `publish: true` lo publica explícitamente.
2. Cada variante requiere `sku` único en mayúsculas, `flavor`, `presentationLabel`, `contentAmount` decimal como cadena, `contentUnit`, `priceCents` como cadena de entero no negativo, `weightGrams`, `lengthMm`, `widthMm` y `heightMm` enteros positivos. Opcionales: `compareAtPriceCents`, `servings`, `servingAmount`, `servingUnit` y objeto `nutritionData`. No completar información faltante por inferencia.
3. Cada imagen requiere `path` bajo `/images/catalog/`, `alt` y `kind` FRONT/NUTRITION/GALLERY; `variantSku` opcional debe pertenecer al producto. Debe existir al menos una FRONT. Colocar archivos revisados en `public/images/catalog/`. Se comprueban tamaño, firma, ubicación real y hash SHA-256. El proceso no descarga imágenes externas.
4. `variants[].lots` acepta varios lotes: `warehouseId` UUID existente, `lotCode`, `initialQty` entero no negativo, `expiresOn` e `importedOn` ISO YYYY-MM-DD, `expiryPrecision` DAY/MONTH, `customsEntry`, `origin` y `certificate` opcional con `path` bajo `/certificates/` para PDF real. Precisión MONTH exige último día del mes. No inventar datos de origen ni certificados. El almacén real se configura por separado.
5. Ejecutar `npm.cmd run catalog:import -- ruta.json` para validar sin escribir; usar `--apply` solo después de revisar los datos y DATABASE_URL. Los archivos también se validan antes de iniciar la transacción.

La importación crea productos/variantes nuevos. Conflictos de slug/SKU, taxonomía contradictoria, recursos modificados bajo la misma ruta o almacenes inexistentes abortan todo el lote. No sobrescribe precios ni historial existente. La recepción inicial se registra en InventoryMovement y el trigger de #33 actualiza la proyección del lote. No se asigna stock directamente. Objetivos y disciplinas son relaciones transversales; categorías se comparten entre productos y admiten Accesorios/Aminoácidos.

La herramienta no reemplaza la administración de actualizaciones de #34. Para completar #3 faltan datos reales, diez productos documentados y su publicación integrada en las vistas.

Lecturas comunes: `GET /api/catalog/products` (máximo 100 productos en esta primera versión; paginación en #8) y `GET /api/catalog/products/:id` UUID. Solo exponen productos publicados, no eliminados, marcas/categorías activas y variantes no eliminadas. Dinero y decimales viajan como cadenas para conservar precisión; medios solo bajo la ruta pública revisada. Errores de conexión devuelven 503 genérico sin credenciales ni mensajes SQL; ID inválido devuelve 400 y producto ausente/no publicado 404. Disponibilidad vendible y FEFO se incorporan en #13, sin fingir stock a partir del prototipo.

Validación: cuatro pruebas del manifiesto; tres pruebas reales con Prisma/PostgreSQL 18.1 en base aislada `fitness_migration_test_final` para recepción por ledger, rollback de lote completo ante conflicto y recursos faltantes. Fixtures sintéticas, sin datos comerciales. El catálogo real no se modificó.

Build Nuxt correcto. API compilada validada con la base aislada: catálogo 200, identificador inválido 400, UUID inexistente 404. La prueba de importación también verifica que el borrador creado no se pueda leer como producto público.
