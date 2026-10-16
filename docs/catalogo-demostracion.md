# Catálogo inicial de demostración

La migración `20261016040000_demo_catalog` agrega 28 productos publicados: cuatro por cada categoría base (Proteína, Creatina, Pre-entreno, Electrolitos, Vitaminas, Aminoácidos y Accesorios). Se conserva cualquier producto previo. Todos los nombres terminan en **DEMO**, pertenecen a la marca **TFS · Demostración académica** y su descripción identifica los valores como simulados.

Incluye descripción, ingredientes o materiales, uso ilustrativo, alérgenos, SKU, sabor, contenido, precio, medidas para empaque, una imagen frontal y recomendaciones para ficha/carrito. Los suplementos incluyen porciones, tamaño de porción y nutrientes ilustrativos; los accesorios no incluyen datos nutrimentales porque no corresponden. Algunos artículos tienen precio anterior para demostrar la comparación.

La migración posterior `20261016050000_demo_catalog_stock`, solicitada por el propietario, agrega un lote `DEMO-INICIAL-01` y existencias ficticias variadas a cada artículo. Registra entradas `RECEIPT` en el historial, sin modificar directamente los saldos. No inventa caducidades, importaciones, aduanas ni certificados. Otra migración agrega [clientes, pedidos y ocho reseñas identificadas como demostración](datos-demostracion-pedidos.md). Estos datos no son un catálogo comercial verificado ni una pauta de consumo.

| Categoría | Artículo 1 | Artículo 2 | Artículo 3 | Artículo 4 |
| --- | ---: | ---: | ---: | ---: |
| Proteína | 2 | 6 | 18 | 40 |
| Creatina | 5 | 24 | 3 | 60 |
| Pre-entreno | 12 | 2 | 30 | 8 |
| Electrolitos | 45 | 15 | 4 | 28 |
| Vitaminas | 20 | 50 | 7 | 3 |
| Aminoácidos | 4 | 16 | 35 | 9 |
| Accesorios | 25 | 5 | 48 | 2 |

La numeración corresponde al sufijo del SKU (`01` a `04`). La carga utiliza el almacén configurado sin cambiar sus datos. Si todavía no hay almacén, se difiere hasta registrarlo desde Administración → Inventario. No se genera una dirección ficticia. La función SQL versionada `initialize_demo_catalog_stock()` y `initializeDemoStock` coordinan esta inicialización; cada variante tiene una clave de movimiento única. Reiniciar o reejecutar no repone stock vendido, ajustado o agotado, ni vuelve a publicar productos retirados. Los artículos comerciales existentes y sus movimientos quedan fuera de esta carga.

## Inicialización

En Docker, el servicio `migrate` aplica la migración al iniciar:

```powershell
docker compose --env-file .env.docker -f compose.docker.yaml up -d --build app
```

Fuera de Docker, configura la conexión y ejecuta `npm run db:deploy` (o `pnpm db:deploy`). Después inicia la aplicación. `db:seed` informa de este mecanismo; no duplica la carga.

Las migraciones se aplican una vez por base. Reiniciar no sobrescribe precios, imágenes o textos editados, no repone artículos eliminados y no vuelve a publicar los retirados. Una base nueva obtiene los 28 artículos al aplicar el historial. Las categorías futuras requieren cargar sus productos desde Administración o mediante otra migración; no existe un generador automático por categoría nueva.

## Asociación de imágenes

Las 28 ilustraciones locales están en `public/images/catalog/demo/`. Son imágenes WebP con la palabra DEMO y sin marcas de terceros. No requieren descargas ni un servicio externo. Docker las incluye en el build de Nuxt.

La migración crea un `MediaAsset` con ruta, MIME, tamaño y SHA-256 del archivo, y un `ProductMedia` que lo asocia al producto como `FRONT`. `variantId` vacío significa imagen genérica para todas sus presentaciones; un ID de variante permite limitarla a una presentación.

Para sustituir una ilustración por una fotografía:

1. Abre Administración → Productos → Gestionar → Imágenes → Agregar imagen.
2. Elige JPG, PNG o WebP de hasta 5 MB y selecciona Imagen frontal, Información nutricional o Galería.
3. Elige Todas las presentaciones o una presentación específica, escribe descripción y motivo y guarda.

Una nueva frontal desplaza la anterior a la galería dentro de la misma asignación. Las cargas administrativas se guardan en el volumen `catalog_images`; hay que respaldarlo junto con la base de datos. Las imágenes locales de la migración siguen disponibles desde el repositorio aunque se recree ese volumen. Las fotografías cargadas desde el panel no aparecen automáticamente en otras instalaciones: para distribuir un catálogo real hay que incluir archivos revisados en `public/images/catalog/` y crear una nueva migración o usar el importador de catálogo con su manifiesto. No se deben colocar rutas `C:\...` ni URLs temporales de la computadora en la base.

## Mantenimiento y verificación

Los datos legibles están en `server/features/catalog/demo-catalog.js`. `node scripts/prepare-demo-catalog.mjs` verifica que la migración congelada coincida con ellos y con el contenido de las imágenes. La opción `--write` se usó para preparar inicialmente los archivos y rechaza sobrescribir una migración existente. Para cambiar un catálogo que ya se instaló se crea otra migración o se edita desde Administración; nunca se altera el SQL aplicado.

`tests/database/demo-catalog.test.mjs` comprueba cuatro por categoría, publicación, campos, recomendaciones, archivos reales con checksum y reejecución sin duplicar ni revertir cambios administrativos. `demo-stock.test.mjs` comprueba cantidades, ledger, disponibilidad, falta de almacén y ausencia de reposición al reejecutar. La comprobación se realiza primero en PostgreSQL temporal antes de aplicar al entorno local.

Verificación: 86 pruebas unitarias y 98 de PostgreSQL aprobadas en base temporal limpia, incluidas cantidades del stock, entradas de historial y preservación de un agotamiento al reejecutar. `scripts/check-demo-catalog-browser.mjs` comprueba las siete categorías, disponibilidad inicial de los 28 artículos, sus imágenes por HTTP, tarjetas, detalle con nutrición y ausencia de desbordamiento en móvil con ambos temas. Esta prueba utiliza lecturas del entorno local y no crea pedidos ni modifica carritos.
