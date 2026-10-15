# Panel de administración

Los productos desactivados se pueden recuperar desde **Gestionar → Reactivar producto**. El modal pide motivo y confirmación; vuelven como borrador y se habilita su edición. **Guardar y publicar** vuelve a exigir imagen frontal y variante activa. `POST /api/admin/catalog/:id/reactivate` comprueba administrador, motivo y `expectedUpdatedAt`, bloquea el producto y registra `REACTIVATE_PRODUCT` en la misma transacción. Solo limpia la baja y la publicación; conserva variantes, imágenes, categorías, precios, inventario e historial. No reactiva variantes desactivadas por separado.


**Guardar cambios** conserva la publicación actual. En productos publicados, **Retirar del catálogo** es una acción separada que abre una confirmación con motivo propio; no guarda los cambios pendientes del editor. En borradores, **Guardar y publicar** guarda los datos y publica. Esto evita confundir el guardado de precios con retirar la publicación.


Los formularios de creación y edición reciben el precio en **pesos MXN**, por ejemplo `150.00`; el precio anterior opcional también utiliza pesos. Se aceptan hasta dos decimales con punto o coma, sin separadores de miles. `price-input.js` convierte mediante enteros exactos antes de enviar a la API y presenta los precios existentes con dos decimales. La base de datos y la API conservan centavos; no se migran ni reinterpretan los precios guardados.


Todos los formularios se abren en modales mediante botones: crear/gestionar producto, crear categoría, agregar imagen, configurar/editar almacén, registrar/ajustar lote, desactivar usuario y consultar/actualizar pedido. Las listas y la información del almacén siguen visibles en la página.

`app/components/UiModal.vue` utiliza un diálogo nativo con título accesible, foco contenido y restaurado al cerrar, Escape y botón Cerrar; bloquea el desplazamiento del fondo y el cierre durante el guardado. Los errores se muestran dentro del modal y conservan los datos para reintentar. La carga de imágenes tiene su propio modal desde la edición del producto.

Disponible en `/admin`. Se utiliza el mismo inicio de sesión de `/cuenta`; una cuenta con rol `ADMIN` muestra el enlace **Panel de administración** en su perfil. Una cuenta cliente no tiene acceso. Cada endpoint revalida el rol vigente en una transacción; ocultar los controles no es la barrera de autorización.

La interfaz amplía las herramientas HTTP del issue #34. Para asignación restringida de administradores se conserva `node scripts/grant-administrator.mjs correo` (consulta) y `--apply` (asigna rol, audita y revoca sesiones). Esta herramienta requiere acceso privilegiado local y no debe exponerse por HTTP.

## Funciones implementadas

- **Productos:** listado paginado y alta de borrador con una variante. Edición de todos los datos del alta: nombre, slug, descripción, SKU, sabor, presentación, cantidad/unidad de contenido, precio, peso y dimensiones. Clasificación principal y adicional por categorías; alta de tipos con datos del administrador. Guardar cambios mantiene la edición abierta y Guardar y publicar aplica los cambios y publica en la misma transacción. Los precios del formulario se introducen en pesos MXN; se conservan controles de versión y auditoría.
- **Inventario:** listado paginado de lotes, existencias/reservas/no vendibles, alta del almacén inicial, ficha de información y edición de nombre, remitente, contacto, teléfono y dirección (incluidos interior y referencias opcionales). Edición con motivo, versión esperada, bloqueo de fila y auditoría. Alta de lotes por SKU y almacén y ajustes positivos/negativos con motivo. Los ajustes utilizan el ledger y una clave de idempotencia; no retiran piezas reservadas.
- **Usuarios:** listado paginado con nombre, correo, rol y estado; confirmación de desactivación de clientes con revocación de sesiones. No se exponen hashes, tokens ni credenciales. Los administradores no se desactivan mediante este flujo.
- **Pedidos:** listado paginado, detalle de cliente/dirección, líneas, importes e historial; avance confirmado → preparación → enviado → entregado con motivo, idempotencia y validación del estado y pago. No se cambia manualmente el estado financiero.

Cada modificación conserva auditoría administrativa, movimiento de inventario o historial de pedido, según el dominio. No se elimina el historial comercial ni se crean productos, almacenes o pedidos de ejemplo en la base de aplicación. No hay cambios de esquema.

## API administrativa

Las consultas requieren sesión ADMIN. Las mutaciones requieren también Origin propio.

| Método / ruta | Campos o resultado |
| --- | --- |
| GET `/api/admin/catalog?page=1` | Productos y variantes, precios como texto, veinte productos por página |
| POST `/api/admin/catalog` | name, description, slug, categoryIds opcional (primera principal), variants (SKU/presentación/contenido/precio en centavos como texto/medidas), reason |
| POST `/api/admin/catalog/:id/images` | multipart: image (JPG/PNG/WebP, máximo 5 MB), alt, kind (FRONT/NUTRITION/GALLERY), reason. Solo ADMIN |
| GET `/api/catalog/images/:id` | Imagen subida procesada; borradores solo para ADMIN, productos publicados accesibles públicamente |
| POST `/api/admin/catalog/check` | slug y/o sku; devuelve slugExists/skuExists, incluyendo borradores y bajas. Requiere ADMIN y Origin propio; no crea registros |
| PATCH `/api/admin/catalog/:id` | Textos/slug, published, deactivate, categoryIds, reason; expectedUpdatedAt y variantes existentes con ID/expectedPriceVersion para guardado atómico |
| PATCH `/api/admin/variants/:id` | SKU, sabor/presentación, contenido/unidad, precios, medidas, deactivate, expectedPriceVersion, reason |
| GET `/api/admin/categories` | Categorías activas disponibles para clasificar |
| POST `/api/admin/categories` | name, slug, reason; alta de categoría con permiso y auditoría |
| GET `/api/admin/inventory?page=1` | Lotes paginados y ficha completa del almacén, incluida configurationVersion para editar |
| POST `/api/admin/warehouse` | Datos de almacén, contacto y dirección mexicana, reason; solo configuración inicial |
| PATCH `/api/admin/warehouse` | Datos de almacén, contacto, dirección, expectedConfigurationVersion y reason; incrementa la versión del origen |
| POST `/api/admin/lots` | sku, warehouseId, lotCode, expiresOn opcional (AAAA-MM-DD), reason; saldo inicial cero |
| POST `/api/admin/inventory` | lotId, delta entero no cero, reason, idempotencyKey |
| GET `/api/admin/users?page=1` | Veinte cuentas por página; sin hashes ni tokens |
| POST `/api/admin/users/:id/deactivate` | reason; conserva historial y revoca sesiones |
| GET `/api/admin/orders?page=1` | Diez pedidos por página con información de comprador |
| GET `/api/admin/orders/:id` | Detalle, comprador, dirección e historial |
| POST `/api/admin/orders/:id/status` | expectedStatus, status, reason, idempotencyKey |

## Límites explícitos

La publicación conserva la validación de imagen frontal documentada. El panel permite [cargar imágenes al producto existente](product-images.md), crear categorías y asignarlas; no incorpora alta de variantes adicionales sobre un producto existente, edición de nombres/baja de categorías, campos nutricionales avanzados ni eliminación/edición de imágenes guardadas. Editar el almacén incrementa `configurationVersion`, incluida en la huella de cotización: las tarifas de carrito anteriores requieren recotizar. Los snapshots de origen de pedidos existentes se conservan. País y zona horaria se muestran como información; no se editan desde este formulario. No hay gestión de roles, restablecimiento de contraseñas ajenas, cancelaciones/reembolsos ni emisión de guías desde el panel. Marcar un pedido como enviado registra el estado; no contrata transporte.

## Edición completa y clasificación

En Productos, **Tipos de suplemento y categorías** permite registrar nombres/slugs proporcionados por el administrador, sin sembrar tipos inventados. El selector **Tipo de suplemento / categoría principal** está en alta y edición; la primera categoría es la principal y se pueden elegir adicionales. La clasificación se refleja en el catálogo y sus filtros al publicar.

La edición precarga los datos guardados y muestra el motivo histórico del alta como información, sin reescribir la auditoría. Se envían solo las variantes modificadas, con su versión, junto con `expectedUpdatedAt` del producto. Un conflicto de versión, SKU, slug, combinación sabor/presentación o categoría revierte el guardado completo. Guardar y publicar valida también la imagen frontal y variantes activas. Los datos originales de pedidos y los vínculos de lotes usan IDs y no se reescriben.

Verificación de esta ampliación: compilación Docker; 61 pruebas unitarias y 79 PostgreSQL aisladas aprobadas; HTTP aislado de categoría, alta clasificada, consulta de todos los campos, edición y publicación atómicas, detalle público y filtro de categoría. Revisión visual/interactiva pendiente en esta sesión.

## Verificación del 15 de octubre de 2026

- Compilación de producción Nuxt dentro de Docker.
- 57 pruebas unitarias y 75 de PostgreSQL aislado correctas. Tras ampliar el detalle administrativo de comprador, las cuatro pruebas de administración/pedidos se ejecutaron de nuevo correctamente, incluyendo la exclusión del correo de comprador del DTO de cliente.
- Pruebas administrativas: permisos de cliente, paginación inválida, serialización de precios, lotes por SKU, caducidad inválida, saldo inicial cero, ajuste por ledger y protección del almacén configurado.
- HTTP local: las cuatro consultas administrativas devuelven 401 sin sesión y 200 con sesión ADMIN; el HTML de `/admin` contiene el panel autenticado. No se crean registros comerciales para esta comprobación.
- La herramienta de navegador no dispone de navegadores conectados en esta sesión. La comprobación SSR/HTTP no sustituye la revisión visual ni la interacción en navegador; ambas quedan pendientes.

El entorno de pruebas conserva el aviso de deprecación existente de pg sobre consultas concurrentes. No se hicieron commits ni push.
