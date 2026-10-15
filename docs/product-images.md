# Imágenes del producto desde administración

## Uso

1. Iniciar sesión como administrador y abrir `/admin` → Productos.
2. Pulsar **Gestionar** sobre el producto existente y bajar a **Imágenes**.
3. Seleccionar un JPG, PNG o WebP de hasta 5 MB. La vista previa permite revisar el archivo antes de subirlo.
4. Elegir Imagen frontal, Información nutricional o Galería. Completar descripción accesible y motivo de la carga.
5. Pulsar **Guardar imagen**. La imagen queda asociada al producto y aparece en su listado de imágenes.
6. Para publicar, revisar los datos del producto/variantes, llenar el motivo de los cambios y pulsar **Guardar y publicar**. La publicación sigue requiriendo una variante activa y una imagen frontal.

**Si Guardar y publicar está deshabilitado:** revisar el aviso junto a los botones de edición. El campo **Motivo de los cambios** es obligatorio y es independiente de **Motivo de la carga** de la imagen. No es necesario guardar por separado primero: Guardar y publicar aplica los datos editados y publica en una transacción. Guardar cambios mantiene la edición abierta y limpia el motivo después de guardarlo. El aviso también identifica falta de imagen frontal, falta de variantes activas o baja del producto.

La carga no publica automáticamente el producto ni modifica sus existencias. Se permiten hasta 20 imágenes por producto. Las imágenes de la carga web son generales para el producto; no se asignan a una variante concreta. Al subir otra frontal o nutricional, la anterior del mismo tipo y ámbito general se conserva como Galería. No hay eliminación ni edición de los metadatos de una imagen guardada en esta versión.

## Implementación

`ProductImages.vue` envía un formulario multipart a `POST /api/admin/catalog/:id/images`. El servidor comprueba sesión ADMIN y Origin antes de leer/procesar el archivo y revalida el rol dentro de la transacción. Se bloquea el producto para coordinar altas concurrentes, límite de imágenes y publicación. Un producto desactivado no admite cargas nuevas.

`uploaded-images.js` decodifica con sharp 0.35.5, valida formato real frente a MIME, rechaza imágenes dañadas/animadas y más de 25 millones de píxeles, aplica orientación y reduce a un máximo de 2000 × 2000 sin ampliar imágenes pequeñas. La salida se vuelve a codificar como WebP sin conservar metadatos originales. No se aceptan SVG ni URLs remotas.

El servidor genera un nombre UUID y guarda `MediaAsset` (tamaño, checksum SHA-256, MIME, creador) y `ProductMedia` (producto, tipo, descripción, orden), además de `UPLOAD_PRODUCT_IMAGE` con motivo. Las restricciones de publicación usan esa asociación existente. No hay cambio de esquema. Ante un fallo de transacción se intenta retirar el archivo recién escrito; un corte abrupto del proceso podría dejar un archivo huérfano, que no se publica sin registro asociado.

`GET /api/catalog/images/:id` sirve únicamente archivos asociados, con comprobación de tamaño/checksum y tipo WebP. Las imágenes subidas de borradores requieren ADMIN; una vez publicado el producto, se pueden visualizar sin sesión. El catálogo usa esta URL dinámica y conserva compatibilidad con los archivos estáticos del importador. No se exponen rutas internas de almacenamiento.

## Persistencia

- Desarrollo local: `.catalog-uploads/` por defecto, excluido de Git y del contexto Docker. Se puede configurar `NUXT_CATALOG_UPLOAD_DIRECTORY` en un directorio persistente.
- Docker: volumen `catalog_images` montado en `/app/catalog-uploads`, accesible al usuario no privilegiado node. Los archivos no dependen de `.output/public` ni se pierden al reconstruir la imagen del contenedor.
- La base conserva metadatos y asociaciones; los archivos se guardan en el volumen. Para recuperar imágenes se necesitan ambos respaldos. No usar `down -v` si se quieren conservar esos datos.

### ¿Se organizan por carpetas de producto?

No en la implementación actual. El volumen real del Compose es `fitness-stuff-local_catalog_images`, montado en `/app/catalog-uploads`. Los archivos están en una sola carpeta, con nombres UUID generados por el servidor y extensión `.webp`, por ejemplo `/app/catalog-uploads/550e8400-e29b-41d4-a716-446655440000.webp` (nombre ilustrativo).

El producto no se identifica por la carpeta ni por el nombre original del archivo. `MediaAsset.storageKey` guarda la clave lógica `uploads/<UUID>.webp`; `ProductMedia.productId` relaciona el producto con `ProductMedia.assetId`, y este último referencia `MediaAsset.id`. El ID del recurso utilizado en `/api/catalog/images/:id` no es necesariamente el UUID del nombre del archivo. La consulta a la base resuelve el archivo y sus permisos.

Por tanto, las imágenes permanecen en el volumen al recrear el contenedor y la asociación con cada producto permanece en PostgreSQL. Moverlas manualmente a carpetas por producto rompería la resolución actual si no se adapta también el código y las claves almacenadas.

## Comprobaciones

Pruebas unitarias: decodificación/reducción a WebP; rechazo de SVG, contenido disfrazado, corrupción, exceso de bytes/píxeles; nombres propios, integridad y rechazo de rutas ajenas. Pruebas PostgreSQL aisladas: permisos, asociación al borrador, publicación, reemplazo de frontal conservando la anterior, auditoría, rollback con limpieza de archivo y rechazo tras desactivación.

El script `scripts/check-product-images-http.mjs` requiere la base `fitness_migration_test_docker` y la instancia temporal `http://fitness-product-images-check:3000`; no funciona contra la tienda real. Comprueba multipart, permisos, Origin, tipos/límites, visibilidad privada del borrador y acceso público después de publicar. La instancia temporal debe usar `NUXT_CATALOG_UPLOAD_DIRECTORY` independiente del volumen real.

Verificado el 15 de octubre de 2026: build Docker correcto; 61 pruebas unitarias y 78 PostgreSQL aisladas aprobadas; recorrido HTTP aislado correcto, incluyendo carga multipart, rechazos 400/401/403/413/415, lectura privada del borrador y pública tras publicación. Volumen de imágenes montado y escribible en el contenedor final; salud HTTP correcta. Las pruebas usaron imágenes sintéticas solo en el entorno aislado, sin cargar archivos a productos reales.

La comprobación HTTP no sustituye la revisión visual e interacción del selector de archivos en navegador, pendiente en esta sesión. npm reporta avisos de seguridad del árbol de dependencias que requieren revisión separada; no se ejecutaron actualizaciones automáticas ni `audit fix --force`.
