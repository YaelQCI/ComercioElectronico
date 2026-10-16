# Guía para explicar y demostrar la plataforma

## Usar direcciones de la cuenta para cotizar

El selector de direcciones guardadas ocupa toda la fila del formulario. **Cotizar servicios** aparece en una fila propia, debajo de los campos y alineado a la izquierda. Ajuste de distribución verificado con compilación; revisión visual pendiente.

En **Carrito → Cotizar envío**, una cuenta con sesión activa puede elegir **Usar una dirección de mi cuenta**. Se carga desde `/api/account/profile`, que devuelve únicamente las direcciones del usuario autenticado. Se propone la predeterminada (o la primera) cuando el formulario está vacío; no sobrescribe datos ya escritos ni una tarifa recuperada. Los invitados conservan la captura manual. Sin direcciones, se muestra un enlace para agregarlas en Mi cuenta; ante fallos de carga se permite reintentar.

La selección completa destinatario, teléfono, calle/números, colonia, ciudad, estado y código postal. `saved-destination.js` convierte nombres reconocidos del estado o sus códigos al catálogo de Envia.com; un estado desconocido queda vacío para seleccionarlo explícitamente. Escribir otra dirección limpia los campos; editar lo completado solo modifica esta cotización, sin cambiar la dirección de la cuenta. Cualquier cambio invalida las tarifas anteriores. Al cerrar sesión o cambiar de cuenta se descarta la selección anterior y se ignoran respuestas de perfil obsoletas.

Demostración: registrar una dirección y marcarla como predeterminada en `/cuenta`, regresar al carrito, comprobar sus datos, seleccionar otra dirección y volver a cotizar. La integración utiliza las mismas cookies y renovación automática de cuenta. Las pruebas de `saved-destination.test.mjs` verifican composición de dirección, conservación de datos, estados por nombre/código y estado desconocido. La compilación y las pruebas de datos no equivalen a una revisión visual ni a una cotización real con Envia.com.

Verificación del cambio: build Docker y formulario Vue correctos; 11 pruebas pertinentes de direcciones, estados y envío aprobadas. Consulta HTTP autenticada al perfil correcta; la cuenta administrativa utilizada para esa comprobación no tenía direcciones, por lo que la conversión de direcciones guardadas se verificó con datos sintéticos. Revisión interactiva pendiente.

## Selector de estado al cotizar envío

En **Carrito → Cotizar envío**, el campo **Estado** utiliza el mismo `UiField` con opciones y el mismo catálogo `mexicanStates` que el formulario del almacén. El usuario selecciona el nombre de una de las 32 entidades; se envía su código de dos letras de Envia.com, sin tener que escribirlo. Por ejemplo, San Luis Potosí envía `SL` y Ciudad de México envía `CX`. Mantiene la selección de una cotización existente, campo obligatorio y bloqueo mientras se consulta; cambiar el estado invalida la tarifa seleccionada y obliga a recotizar. No se modificaron los datos de direcciones existentes ni se hicieron consultas reales al proveedor para esta comprobación.

## Existencias y cantidades en el carrito

La etiqueta **Cantidad** va sobre el grupo completo de controles. El campo y los botones −, +, Actualizar y Quitar se alinean en una fila flexible; el máximo y los errores aparecen debajo para no desplazar los botones. El control conserva etiqueta, descripción accesible, límites y estados deshabilitados. Ajuste verificado mediante compilación; revisión visual pendiente.

Cada línea muestra las piezas disponibles para comprar y, cuando hay demanda compartida con otras líneas o combos, su máximo específico. No representa todo el inventario físico: descuenta reservas y excluye lotes bloqueados/vencidos. El campo de cantidad limita lo escrito al máximo de esa línea. Si el carrito tenía más piezas que las disponibles, propone ese máximo en el campo y muestra las cantidades con la instrucción **Actualizar**; no modifica automáticamente la cantidad guardada ni los totales sin confirmar.

Sin stock muestra **Por el momento no hay existencias de esta presentación**, y deshabilita cantidad, +, − y Actualizar; permite quitar o guardar para después. Si el producto se retiró o desactivó, muestra un mensaje distinto de producto no disponible. Si otras líneas o combos consumen el máximo, lo explica por separado. `stock-feedback.js` centraliza límites y mensajes; `cart-observation.js` usa esos mismos mensajes para los cambios detectados. El servidor revalida al guardar y al iniciar compra: el carrito no reserva existencias. Las pruebas verifican reducción real por ledger, límite actualizado, rechazo de exceso, corrección y eliminación cuando se agota.

Verificación: build Docker, 74 pruebas unitarias y 86 PostgreSQL correctas. Lectura del carrito local, sin modificarlo: tenía 2 piezas, disponible/máximo 1 y cantidad propuesta 1, con aviso explícito para actualizar. Revisión visual e interacción en navegador pendientes.

## Imágenes subidas en el carrito

El carrito utiliza la misma conversión segura de imágenes del catálogo (`publicImage`): los archivos subidos al volumen se sirven mediante `/api/catalog/images/:assetId`, mientras las imágenes estáticas revisadas conservan `/images/catalog/...`. Antes, el carrito descartaba las rutas de almacenamiento `uploads/...` y mostraba «Imagen no disponible» aunque la foto existiera. Se prioriza la frontal de la variante y, si no existe, la frontal general del producto. No se muestran rutas internas ni se cambian las reglas de publicación del endpoint de imágenes.

Para comprobarlo, añade al carrito un producto publicado con imagen frontal cargada desde el administrador y abre `/carrito`. La miniatura debe aparecer sin volver a subir la foto ni quitar/agregar el producto. El contenedor de miniatura conserva un tamaño de 112 × 112 px para que el componente de imagen no se extienda a toda la fila. `tests/database/cart.test.mjs` verifica imágenes estáticas, subidas, prioridad de variante y rechazo de rutas no públicas. La comprobación de código/HTTP no sustituye la revisión visual en navegador.

Verificación de la corrección: build Docker, 72 pruebas unitarias y 85 PostgreSQL correctas. El carrito local existente devuelve la URL de imagen esperada y la descarga WebP responde HTTP 200 con contenido, sin alterar sus productos. Revisión visual pendiente.

## Abrir productos desde su tarjeta e imagen

En el catálogo, inicio y recomendaciones que usan `ProductCard`, tanto la imagen como el título y la superficie de la tarjeta abren `/producto/:id`. `UiCard` extiende el enlace del título a su superficie; `CardPackshot` enlaza la imagen de forma independiente para conservar su vista nutrimental al pasar el cursor. Los botones de carrito, información nutrimental y formulario de reposición mantienen sus propias acciones sin estar anidados en enlaces. Los enlaces permiten teclado y abrir en otra pestaña. La verificación de compilación y HTML SSR no equivale a una prueba visual de clics.

## Abrir productos desde inventario

En **Administrador → Inventario**, pulsa el nombre, las existencias o el espacio de una tarjeta de lote para abrir la página del producto con la variante seleccionada. **Ajustar lote** sigue abriendo el modal sin navegar. Se usa un enlace nativo extendido a la tarjeta con foco visible, sin anidar el botón dentro del enlace; permite Tab, Enter y abrir en otra pestaña. La consulta administrativa devuelve `productId`, `variantId` y nombre para construir el enlace. Las reglas de acceso público siguen vigentes: un producto sin publicación no queda expuesto por este enlace. Prueba de servidor: el DTO del lote conserva los IDs y el nombre correctos. Interacción visual en navegador pendiente.

## Registrar el número de porciones

En **Administrador → Productos → Crear producto en borrador** escribe el dato de la etiqueta en **Número de porciones por envase (opcional)**. Para un artículo existente, abre **Gestionar**, busca el campo dentro de su variante, modifica el valor e indica el motivo antes de **Guardar cambios**. Se precarga el valor actual. Puedes dejarlo vacío si no corresponde al artículo o desconoces el dato; vaciarlo elimina el dato y excluye esa variante del filtro por porción. No modifica el estado de publicación.

Se admiten números positivos, hasta diez dígitos enteros y cuatro decimales con punto. El dato pertenece a cada variante/presentación. `parseServings` valida la entrada en servidor; `variantData` la guarda, la consulta administrativa la devuelve como texto y la edición registra valores anterior/nuevo en auditoría. Se reutiliza la columna `ProductVariant.servings`; no hace falta cambiar el esquema. Los campos de porción no se deducen del peso. Las pruebas cubren alta, edición, eliminación, permisos, formatos inválidos, conservación en ediciones ajenas y efecto en el filtro público.

## Cómo funciona el filtro de costo por porción

Divide el precio vigente de cada variante entre su número de porciones (`ProductVariant.servings`). Ejemplo ilustrativo: un bote de $600 MXN con 30 porciones cuesta $20 por porción y cumple **De $15 a $30 MXN**. No representa el precio del bote ni el costo por gramo. No incluye envío, cupones ni puntos; usa el precio vigente, no el precio anterior de referencia.

Los límites son **Menos de $15**, **De $15 a $30** (incluye exactamente $15 y $30) y **Más de $30**. El filtro compara la razón exacta con enteros, sin redondear antes de clasificar; la etiqueta visible sí se redondea a centavos. Seleccionar varios rangos admite cualquiera de ellos; al combinar con disponibilidad, presentación o precio, una misma variante debe cumplir todos los grupos. El producto aparece si queda al menos una variante compatible.

Si no existe el número de porciones, la variante no aparece al activar este filtro. El sistema no lo deduce del peso ni inventa porciones. El administrador puede registrar `servings` en el campo **Número de porciones por envase (opcional)** al crear o editar cada variante, usando el dato documentado de la etiqueta. Registrar stock no completa las porciones automáticamente.

Para demostrarlo: abre `/catalogo`, despliega **Costo por porción**, marca un rango y compara el precio y número de porciones de una variante con esos datos registrados. Una consulta de ejemplo es `/catalogo?porcion=15-30`. Puede devolver cero resultados si las variantes publicadas carecen de porciones. Código: `servingRatio` en `shared/features/pricing/prices.js` y `filterProducts` en `shared/features/catalog/filters.js`. Las pruebas `tests/catalog/filters.test.mjs` verifican los límites exactos y la combinación entre filtros. Explicación revisada contra el código; no equivale a comprobación visual en navegador.

## Categorías sin productos en el filtro público

En `/catalogo`, el filtro **Categorías** muestra todas las categorías activas del sistema, aunque todavía no tengan productos publicados. Así aparecen los siete tipos base desde el inicio. Al marcar un tipo vacío se muestra el estado sin resultados; los borradores y productos desactivados permanecen ocultos. `catalog-repository.js` consulta las opciones desde `Category`, mientras conserva el filtrado de los productos públicos. La prueba PostgreSQL de `catalog-search.test.mjs` verifica tipos base, categorías vacías, exclusión de inactivas y cero resultados al seleccionar una vacía.

## Tipos de suplemento obligatorios al desplegar

La migración `20261016010000_required_supplement_categories` incorpora Proteína (`proteina`), Creatina (`creatina`), Pre-entreno (`pre-entreno`), Electrolitos (`electrolitos`), Vitaminas (`vitaminas`), Aminoácidos (`aminoacidos`) y Accesorios (`accesorios`). Usa el slug único para conservar la identidad y las asociaciones de las categorías existentes. Son datos base solicitados por el propietario; no son productos de prueba.

En un servidor nuevo, ejecutar `npm run db:deploy` antes de iniciar la aplicación. Docker ya ejecuta las migraciones antes de arrancar el servicio app. En cada inicio, `server/plugins/supplement-categories.js` delega a `ensureSupplementCategories`, que asegura las siete categorías en una transacción, recupera faltantes y activa las existentes. El catálogo compartido está en `shared/features/catalog/supplement-categories.js`. No se borran otras categorías ni se asignan productos automáticamente.

Para verlo, abre **Administrador → Productos → Crear producto en borrador** o **Gestionar**, y revisa el selector **Tipo de suplemento / categoría principal**. Las categorías públicas usan esos mismos slugs; su contenido depende de los productos publicados que tengan asignados. Si alguien altera directamente la base mientras la aplicación está encendida, la comprobación de recuperación se ejecuta en el siguiente arranque. Las pruebas aisladas verifican presencia, reactivación, recuperación de faltantes, repetición sin duplicados y conservación de vínculos.

## Cantidad inicial de un lote

En **Inventario → Registrar lote**, selecciona producto/SKU, almacén y código de lote; escribe la **Cantidad inicial (piezas)**, por ejemplo `20`, y completa caducidad si corresponde y motivo. Al guardar, el lote aparece con 20 existencias. Para registrar el lote sin stock se permite `0`. Las siguientes entradas o salidas se registran con **Ajustar lote**.

`createLot` valida un entero no negativo y coordina el alta, el movimiento de entrada y la auditoría en una transacción. La entrada usa el ledger existente con clave propia del lote; el saldo se deriva de ese movimiento. Si hay un fallo se revierte todo. Repetir un alta con la misma variante, almacén y código no duplica existencias. Las pruebas PostgreSQL comprueban cantidades inválidas, entrada inicial, auditoría, rechazo de duplicados y ajustes posteriores. No se modifica el stock de lotes ya existentes. La revisión visual en navegador queda pendiente.

## Buscar un producto para registrar lotes

En **Administrador → Inventario → Registrar lote**, pulsa el campo **Producto / SKU de la variante** y escribe al menos dos caracteres del nombre o SKU. Los resultados muestran nombre, SKU, sabor y presentación. Elige con el ratón o con flechas y Enter: el campo muestra solo el SKU. Cuando vuelves al campo aparece el nombre del producto; puedes confirmar o buscar otra variante. Si modificas el texto, debes seleccionar de nuevo un resultado antes de registrar. Escape cierra los resultados sin cerrar el modal en esa primera pulsación.

La interfaz está en `LotVariantPicker.vue`; cancela búsquedas anteriores para evitar resultados obsoletos. El endpoint administrativo `GET /api/admin/inventory/variants` delega a `searchLotVariants`, usa consulta parametrizada y limita los resultados a 20. Busca sin distinguir acentos o mayúsculas, incluye borradores activos y excluye bajas de productos o variantes. `createLot` conserva la validación final de disponibilidad. Las pruebas PostgreSQL verifican permisos, búsqueda por nombre/SKU, acentos y exclusión de bajas. La revisión visual/interactiva sigue pendiente en esta sesión.

## Renovación automática de sesión

El JWT conserva su vigencia máxima de 15 minutos y la sesión el máximo absoluto de siete días. El navegador consulta el estado al iniciar, regresar a una pestaña visible y antes de enviar peticiones a la API cuando corresponde comprobar el vencimiento. Si falta el acceso pero existe una credencial de renovación, llama a `POST /api/account/refresh`, recibe nuevas cookies HttpOnly y continúa. Si el acceso vence entre la comprobación y una petición que responde 401, solo reintenta una vez y únicamente tras una renovación real. No guarda tokens en localStorage ni los expone a JavaScript.

`app/features/accounts/session-renewal.js` coordina peticiones simultáneas. El plugin `app/plugins/account-session.client.js` integra el transporte del navegador, comparte la identidad entre cuenta y administrador y recupera consultas tras una carga SSR con acceso vencido. La renovación ocurre después de hidratar la página: puede verse brevemente el estado sin sesión en una recarga con JWT vencido. El perfil se recarga cuando se recupera la identidad.

El bloqueo [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) impide renovar simultáneamente desde varias pestañas del mismo origen. Cada pestaña vuelve a consultar la sesión dentro del bloqueo, usando las cookies actualizadas por las anteriores. La renovación manual utiliza el mismo bloqueo. Si el navegador no dispone de Web Locks (requiere un contexto seguro, como HTTPS o localhost), la renovación automática queda deshabilitada y se conserva la manual para evitar consumir dos veces una credencial. Los errores temporales permiten reintentar; una sesión revocada o vencida requiere iniciar sesión de nuevo. No hay renovación periódica con la aplicación cerrada.

Verificación automatizada: `tests/accounts/session-renewal.test.mjs` cubre concurrencia, pestañas simuladas, renovación manual simultánea, 401, errores de red/servicio, visitantes y límites de reintento. `scripts/check-session-renewal-http.mjs` permite comprobar cookies, rotación, permisos, edición tras vencer acceso y logout en HTTP con una base aislada. Las pruebas de cuentas conservan la detección de reutilización y verifican que renovar no extiende el vencimiento absoluto. La interacción real en navegador sigue pendiente de validación.

Resultado de esta implementación: build Docker correcto, 71 pruebas unitarias y 80 PostgreSQL aprobadas; recorrido HTTP aislado correcto (recuperación concurrente, cookie rotada, límite absoluto conservado, edición con acceso vencido y logout).

## Reactivar un producto desactivado

En `/admin` abre **Productos → Gestionar** sobre un producto marcado **Desactivado**. Pulsa **Reactivar producto**, escribe el motivo y confirma. El producto vuelve a **Borrador**, conserva sus datos e inventario y permite editar de nuevo. Revisa sus campos, escribe el motivo de los cambios y utiliza **Guardar y publicar** cuando cumpla los requisitos. La reactivación por sí sola no lo muestra al cliente ni reactiva variantes dadas de baja independientemente.

Implementación: `reactivateProduct` en `server/features/administration/manage-store.js`, endpoint `POST /api/admin/catalog/:id/reactivate` y modal en `ProductsAdministration.vue`. Exige rol administrador vigente, motivo y versión; la recuperación y su auditoría son atómicas. Las pruebas PostgreSQL verifican permisos, motivo, versión obsoleta, conservación de la variante, regreso a borrador y edición posterior. La revisión visual en navegador queda pendiente.

## Cambiar precios sin retirar la publicación

En un producto publicado, modifica el precio y pulsa **Guardar cambios**: la petición omite `published` y conserva `publishedAt`. Para ocultarlo hay que pulsar **Retirar del catálogo**, indicar un motivo y confirmar en otro modal. El retiro envía únicamente la decisión de publicación, la versión esperada y el motivo; no guarda otros cambios pendientes. La auditoría registra ambas operaciones. `tests/database/administration.test.mjs` comprueba que una edición completa de variante y precio mantiene la fecha de publicación existente.

## Precios en pesos en el administrador

En **Productos → Crear producto en borrador** o **Gestionar**, escribe `150.00` en **Precio en pesos (MXN)**. Al guardar se envía `15000` centavos a la API. Al volver a editar aparece `150.00`; el precio anterior opcional sigue la misma conversión y debe superar el vigente. Se permiten punto o coma decimal y hasta dos decimales, sin separadores de miles. La conversión utiliza `BigInt` para evitar errores de precisión; los precios existentes permanecen intactos. Código: `app/features/administration/price-input.js` y `ProductsAdministration.vue`. Pruebas: `tests/catalog/price-input.test.mjs` cubre conversión, ida y vuelta, valores vacíos opcionales y formatos/rangos inválidos. La comprobación visual en navegador sigue pendiente.

## Confirmaciones mediante toast

Las operaciones de administración, cuenta y apariencia, carrito/cupones, reseñas, avisos de reposición, solicitudes posventa y confirmación al iniciar pago muestran sus mensajes mediante un toast compartido. `app/composables/useToasts.js` mantiene la cola durante la navegación interna; `UiToasts.vue` la presenta en la página o dentro del diálogo abierto para que siga visible y accesible sobre un modal. `UiToast.vue` permite cerrar cada aviso y lo retira tras ocho segundos, pausando el tiempo al pasar el cursor o enfocar sus controles. Se muestran hasta cuatro avisos simultáneos y se anuncian mediante una región `aria-live="polite"`.

Para demostrarlo, guarda un producto o una categoría desde `/admin`, cambia la apariencia en `/cuenta` o agrega un producto al carrito. La confirmación aparece flotando en la esquina inferior derecha; puedes cerrarla manualmente. Los errores y las validaciones permanecen junto a sus formularios para permitir corregirlos. Los estados permanentes, como existencias y estado del pedido, siguen en sus vistas.

Verificación: comprobación de la cola y los mensajes repetidos, compilación de plantillas Vue y build Docker. Revisión visual y de interacción en navegador pendiente en esta sesión.

## Formularios administrativos en modales

En `/admin`, pulsa **Crear producto en borrador**, **Gestionar**, **Crear tipo de suplemento o categoría**, **Agregar imagen**, **Configurar almacén inicial**, **Editar almacén**, **Registrar lote**, **Ajustar lote**, **Desactivar usuario** o **Ver pedido** según la sección. Cada formulario aparece en un diálogo modal mediante `UiModal.vue`; las operaciones y validaciones del servidor se conservan. Cerrar o Escape devuelve el foco al control de apertura; durante una petición se bloquea el cierre. Los fallos se muestran dentro del modal para corregir y reintentar.

Verificación de este cambio: compilación de las plantillas Vue y compilación Docker. La interacción visual en navegador queda pendiente de comprobar.

Esta guía documenta la implementación del repositorio para preparar la exposición. Se ampliará con los siguientes requisitos que se revisen. Fecha de revisión del código: 15 de octubre de 2026.

Las instrucciones de demostración son pasos para realizar en el navegador; no significan que se haya ejecutado una prueba visual en esta revisión. Usar una cuenta de prueba identificada como tal para registrar usuarios, cambiar contraseñas o agregar direcciones. No incluir contraseñas, cookies ni claves secretas en las evidencias.

## 1. Registro de usuarios — User registration

### Cómo está implementado

1. En `/cuenta`, **Crear cuenta** muestra nombre, correo, contraseña y confirmación.
2. El formulario envía `POST /api/account/register`.
3. El servidor comprueba los datos y normaliza el correo quitando espacios exteriores y convirtiéndolo a minúsculas. No elimina puntos ni etiquetas del correo.
4. La contraseña se procesa con **scrypt**, una sal aleatoria de 16 bytes y un resultado derivado de 64 bytes. Se almacena el hash junto con los parámetros y la sal; no se guarda la contraseña legible.
5. Se crea un registro `User` con rol `CUSTOMER`. La unicidad de `emailNormalized` en PostgreSQL evita cuentas duplicadas incluso ante registros simultáneos.
6. En la misma transacción se crea la sesión y se entregan las cookies. Si falla la operación, no se conserva un registro parcial.

### Cómo mostrarlo en la plataforma

1. Abrir http://localhost:3001/cuenta sin sesión; si se está usando una cuenta, cerrar sesión o abrir una ventana privada.
2. Pulsar **Crear cuenta** y registrar una cuenta de prueba con un correo distinto.
3. Mostrar que aparecen el perfil y el correo de la cuenta al terminar.
4. Recargar para comprobar que la sesión continúa.
5. Para ver la petición: abrir F12 → **Red/Network**, filtrar `register` y revisar el método y estado. La solicitud contiene la contraseña: no proyectar ni capturar el cuerpo con credenciales reales.

### Preguntas y respuestas

- **¿Puede registrarse alguien como administrador?** No desde el formulario. El servidor fija `CUSTOMER`; asignar administradores requiere el procedimiento local privilegiado.
- **¿Qué pasa si repito un correo?** La base impide el duplicado y el servidor responde con un conflicto, sin crear otra cuenta.
- **¿Se verifica que el correo exista?** Se valida su formato y unicidad. La verificación de propiedad mediante correo todavía no está habilitada.

### Código de referencia

- Interfaz: [`app/features/accounts/AccountView.vue`](../app/features/accounts/AccountView.vue), función `submitAccount`.
- Caso de uso y persistencia: [`server/features/accounts/account-repository.js`](../server/features/accounts/account-repository.js), método `register`.
- Hash y validación: [`server/features/accounts/credentials.js`](../server/features/accounts/credentials.js), `hashPassword`, `emailAddress` y `validPassword`.
- Modelo y restricción única: [`prisma/schema.prisma`](../prisma/schema.prisma), modelo `User`.

**Frase para exponer:** “El registro se valida en el servidor, guarda la contraseña como hash scrypt y crea una cuenta de cliente con su sesión dentro de una transacción.”

## 2. Inicio y cierre de sesión — Login/logout

### Cómo está implementado

- **Login:** `POST /api/account/login` normaliza el correo y compara la contraseña con el hash almacenado mediante scrypt y comparación de tiempo constante. Rechaza cuentas desactivadas. El mensaje de error es el mismo para un correo inexistente y una contraseña incorrecta.
- Tras comprobar las credenciales, crea `AuthSession` y `RefreshCredential` en PostgreSQL y emite las cookies `fitness_access` y `fitness_refresh`.
- **Logout:** `POST /api/account/logout` revoca la sesión en la base y elimina las cookies del navegador. Si el token de acceso ya venció, puede identificar la sesión mediante la credencial de renovación.
- El cierre normal afecta a la sesión actual. Cambiar la contraseña o desactivar la cuenta revoca todas sus sesiones.

### Cómo mostrarlo en la plataforma

1. En `/cuenta`, elegir **Iniciar sesión** e ingresar con una cuenta activa.
2. Mostrar que el formulario cambia al perfil.
3. Pulsar **Cerrar sesión** y comprobar que vuelve el formulario de acceso.
4. Recargar: el perfil no debe reaparecer.
5. En F12 → **Red**, se observan las peticiones `login` y `logout`. En **Aplicación/Application → Cookies → http://localhost:3001**, se pueden comprobar los nombres de las cookies y su eliminación, sin mostrar sus valores.

### Preguntas y respuestas

- **¿Cerrar sesión solo borra una variable del navegador?** No. También revoca la sesión en PostgreSQL, por lo que un token de acceso de esa sesión deja de ser aceptado aunque no haya vencido.
- **¿Cliente y administrador tienen diferentes formularios?** No. Usan el mismo login; sus permisos dependen del rol vigente en la base.
- **¿Se recuerda la contraseña en localStorage?** La aplicación no la guarda allí. El gestor de contraseñas del navegador es una función independiente.

### Código de referencia

- [`server/features/accounts/account-repository.js`](../server/features/accounts/account-repository.js): `login`, `logout` y función interna `session`.
- [`server/features/accounts/account-http.js`](../server/features/accounts/account-http.js): emisión y eliminación de cookies.
- [`app/features/accounts/AccountView.vue`](../app/features/accounts/AccountView.vue): `perform` y botón **Cerrar sesión**.

**Frase para exponer:** “El login comprueba las credenciales y crea una sesión persistida; el logout revoca esa sesión y elimina sus cookies.”

## 3. Autenticación — Authentication

### Cómo está implementada

El sistema combina un **JWT firmado con HS256** y una **sesión consultada en PostgreSQL**. No depende únicamente de que el navegador tenga un token.

El JWT contiene:

| Campo | Uso en la plataforma |
| --- | --- |
| `iss` | Emisor: `the-fitness-stuff` |
| `aud` | Destinatario: `fitness-account` |
| `sub` | ID del usuario |
| `sid` | ID de la sesión |
| `ver` | Versión de autenticación del usuario |
| `iat` | Momento de emisión |
| `exp` | Vencimiento: hasta 15 minutos, sin superar el límite de la sesión |

La firma usa HMAC-SHA256 y una clave privada de configuración de 32 bytes representada en Base64. **El JWT está firmado, no cifrado:** el contenido se puede decodificar, pero modificarlo invalida la firma. No contiene la contraseña ni el rol administrativo.

En cada petición protegida, el servidor:

1. Lee `fitness_access` de las cookies.
2. Comprueba estructura, algoritmo, firma, emisor, destinatario y tiempos del JWT.
3. Busca `AuthSession` y su usuario en PostgreSQL.
4. Rechaza sesiones revocadas o vencidas, cuentas desactivadas y versiones `authVersion` distintas.
5. Obtiene la identidad vigente para ejecutar la operación.

Por esto es una autenticación con estado en servidor: permite revocar el acceso antes del vencimiento del JWT.

### Cookies y renovación

| Cookie | Contenido y duración |
| --- | --- |
| `fitness_access` | JWT, hasta 15 minutos |
| `fitness_refresh` | Credencial aleatoria opaca; sesión con máximo absoluto de 7 días |

Las cookies usan `HttpOnly` y `SameSite=Strict`; `Secure` se activa fuera del modo desarrollo. En Docker se ejecuta el build de producción, así que se emiten con `Secure`. Para un despliegue remoto se debe servir la aplicación mediante HTTPS; no se debe presentar el localhost HTTP de demostración como transporte cifrado.

`HttpOnly` impide leer las cookies mediante `document.cookie`; el navegador puede seguir enviándolas en las peticiones. La aplicación no guarda estos tokens en localStorage.

`POST /api/account/refresh` rota la credencial de renovación: consume la anterior y emite otra. En la base se almacena su hash SHA-256, no el valor original. Si se reutiliza una credencial consumida, se revoca la sesión asociada. Renovar no extiende el límite absoluto de 7 días.

### Cómo mostrarlo en la plataforma

1. Iniciar sesión en `/cuenta`.
2. En F12 → **Aplicación/Application → Cookies**, localizar `fitness_access` y `fitness_refresh` y mostrar sus atributos, ocultando sus valores.
3. En **Red/Network**, revisar `GET /api/account/session`: devuelve el usuario público autenticado. Sin sesión devuelve `{ "user": null }`; esto es una consulta de estado, no un error.
4. Abrir `/api/account/profile` en una pestaña del mismo navegador: con sesión válida responde el perfil; sin sesión devuelve 401.
5. Cerrar sesión y volver a consultar el perfil para demostrar que ya no se autoriza el acceso.
6. Para demostrar la renovación automática, deja vencer el acceso (15 minutos) y realiza una consulta o guarda un cambio. El navegador renueva sin pedir contraseña mientras la sesión de siete días siga vigente. También comprueba al cargar la aplicación y volver a una pestaña visible.

**Aclaración sobre la interfaz:** existe renovación automática por actividad, sin mantener temporizadores de renovación en segundo plano. El botón **Renovar mi sesión** se conserva como alternativa manual.

### Autenticación frente a autorización

- **Autenticación:** determina quién está haciendo la petición, mediante token y sesión.
- **Autorización:** determina qué puede hacer. Los endpoints administrativos revalidan en la base que la cuenta siga activa y tenga rol `ADMIN`, dentro de la transacción de la operación.
- Para mostrar esta diferencia, abrir `/admin` con una cuenta cliente: se informa que no tiene permisos. Con la cuenta ADMIN aparecen las secciones administrativas. La API rechaza solicitudes sin identidad con 401 y usuarios sin permiso con 403.

### Preguntas y respuestas

- **¿Qué es un JWT?** Un formato de token con cabecera, carga de datos y firma. Aquí identifica usuario y sesión durante un plazo limitado.
- **¿Un JWT es una contraseña cifrada?** No. No lleva la contraseña; sus datos se pueden decodificar y la firma permite verificar que no fueron alterados.
- **¿Por qué consultar la base si ya existe un JWT?** Para comprobar revocación, desactivación y versión de autenticación, además de obtener los permisos vigentes.
- **¿Cómo se impide que alguien se dé rol ADMIN cambiando el token?** El token no lleva ese rol y cualquier modificación invalida la firma. Además, la autorización consulta el rol en PostgreSQL.
- **¿La sesión dura 15 minutos o 7 días?** El acceso dura hasta 15 minutos; la renovación permite obtener nuevos accesos hasta el límite absoluto de 7 días.
- **¿Usa Google, OAuth o doble factor?** No en la implementación actual. Usa correo y contraseña con JWT y sesiones propias.

### Código de referencia

- [`server/features/accounts/credentials.js`](../server/features/accounts/credentials.js): `issueAccess`, `verifyAccess`, `opaqueToken` y `secretHash`.
- [`server/features/accounts/account-repository.js`](../server/features/accounts/account-repository.js): `authenticate`, `refresh` y `session`.
- [`server/features/accounts/account-http.js`](../server/features/accounts/account-http.js): `accountIdentity` y opciones de cookies.
- [`server/utils/authorization.js`](../server/utils/authorization.js): `requireAdministrator`.

**Frase para exponer:** “Usamos JWT firmados con HS256 en cookies HttpOnly y comprobamos además la sesión en PostgreSQL. Así podemos revocar el acceso y verificar los permisos actuales.”

## 4. Perfil de usuario — User profile

### Cómo está implementado

- `GET /api/account/profile` obtiene el perfil y sus direcciones usando el ID de la sesión; no acepta un ID arbitrario del navegador para elegir otra cuenta.
- `PATCH /api/account/profile` permite actualizar nombre y teléfono. No permite cambiar el rol ni el correo desde este formulario.
- `POST /api/account/addresses` agrega direcciones y permite establecer una como predeterminada. El servidor comprueba que una dirección existente pertenezca al usuario y cambia la predeterminada dentro de una transacción.
- `POST /api/account/password` exige la contraseña actual, deriva el nuevo hash e invalida todas las sesiones.
- La respuesta pública excluye hashes y tokens. Incluye datos como ID, correo, nombre, teléfono, rol e indicador de verificación de correo.

### Cómo mostrarlo en la plataforma

1. Iniciar sesión y abrir `/cuenta`.
2. Cambiar el nombre o teléfono y pulsar **Guardar perfil**.
3. Recargar para mostrar que el cambio quedó persistido.
4. Con una cuenta de prueba, pulsar **Agregar dirección** para abrir el modal. Completar los datos, guardar y comprobar que el modal se cierra y la dirección aparece en la lista. **Cancelar**, **Cerrar** o Escape permiten cerrarlo sin guardar; durante el envío se bloquea el cierre para evitar operaciones ambiguas.
5. Si hay varias direcciones, usar **Usar como predeterminada** para comprobar el cambio.
6. Para explicar el cambio de contraseña, mostrar el formulario. Ejecutarlo únicamente con una cuenta de prueba: cerrará sus sesiones.

### Preguntas y respuestas

- **¿Se pueden consultar perfiles ajenos cambiando una URL?** El endpoint de perfil personal usa la identidad autenticada. Las direcciones existentes también se filtran por propietario.
- **¿Se guardan los cambios solo en Vue?** No. La interfaz envía una petición al servidor y Prisma persiste los cambios en PostgreSQL.
- **¿El usuario puede cambiar su rol desde el perfil?** No. La actualización solo admite los campos autorizados.

### Código de referencia

- [`app/features/accounts/AccountView.vue`](../app/features/accounts/AccountView.vue): `loadProfile` y formularios de perfil/direcciones/contraseña.
- [`server/features/accounts/account-repository.js`](../server/features/accounts/account-repository.js): `profile`, `updateProfile`, `saveAddress` y `password`.
- [`server/features/accounts/account-http.js`](../server/features/accounts/account-http.js): obtención de la identidad y despacho de acciones.

**Frase para exponer:** “El perfil permite administrar datos personales y direcciones. El servidor identifica al propietario mediante su sesión y persiste los cambios en PostgreSQL.”

## 5. Validaciones apropiadas — Appropriate validation

### Qué se valida realmente

| Dato u operación | Validación existente | Cómo demostrarlo |
| --- | --- | --- |
| Campos de registro | Nombre, correo, contraseña y confirmación obligatorios | Intentar enviar el formulario vacío |
| Nombre | Texto no vacío al recortar, máximo 120 caracteres y sin caracteres de control | Intentar un nombre formado solo por espacios; el servidor lo rechaza |
| Correo | Formato básico, máximo 254 caracteres, normalización y unicidad | Correo sin formato válido o registro repetido |
| Contraseña nueva | Mínimo 12 caracteres y máximo 256 bytes en servidor | Introducir una contraseña corta |
| Confirmación | Coincidencia exacta, sin recortar ni normalizar la contraseña | Introducir contraseñas distintas y salir del campo |
| Credenciales de acceso | Comparación de hash y cuenta activa | Iniciar sesión con contraseña incorrecta |
| Teléfono del perfil | Opcional, texto recortado y máximo 25 caracteres si se proporciona | Explicar que no hay validación de formato telefónico ni comprobación por SMS |
| Dirección | Campos requeridos, límites de longitud y código postal mexicano de cinco dígitos | Guardar con un código postal de longitud incorrecta |
| Propiedad de dirección | Debe pertenecer a la identidad autenticada | Se demuestra mediante pruebas de integración; no existe un control visual para elegir un dueño ajeno |
| Permisos | Solo ADMIN activo puede ejecutar operaciones administrativas | Acceder a `/admin` con una cuenta cliente |
| Intentos repetidos | Login: máximo 10 solicitudes por acción/IP en una ventana de 15 minutos | Explicar el 429 y mostrar el código/pruebas; no es necesario agotar el límite durante la exposición |
| Origen de mutaciones | El encabezado Origin debe coincidir con el origen de la aplicación | Revisar la función `requireCartOrigin`; no se demuestra solo mirando el formulario |

Las validaciones se realizan en distintas capas:

1. **Navegador/Vue:** `required`, `type="email"`, límites de longitud, mensaje de confirmación y foco en el campo con error. Los campos de contraseña tienen un botón para mostrar u ocultar su contenido.
2. **Servidor:** vuelve a validar los datos y comprueba autenticación, permisos, propiedad y reglas de negocio. Saltarse la validación HTML no evita estos controles.
3. **PostgreSQL:** restricciones únicas, claves foráneas y demás restricciones del esquema mantienen la integridad de los datos.

### Preguntas y respuestas

- **¿Basta con poner required en el HTML?** No. El cliente se puede modificar; las validaciones relevantes se repiten en el servidor y la base.
- **¿Se exige una contraseña con números, mayúsculas y símbolos?** No. La regla actual exige longitud y confirmación; no hay un medidor de fortaleza ni comprobación de contraseñas filtradas.
- **¿El correo válido asegura que pertenece al usuario?** No. Validar formato es distinto de verificar propiedad por correo.
- **¿El código postal verifica que la dirección exista?** No. Aquí se valida su formato de cinco dígitos; no se verifica su existencia física.
- **¿El límite bloquea solo intentos fallidos?** No. Cuenta las solicitudes de la acción por IP durante la ventana, incluidas las que resultan exitosas.

### Código y pruebas de referencia

- [`shared/features/accounts/registration.js`](../shared/features/accounts/registration.js): confirmación compartida entre cliente y servidor.
- [`server/features/accounts/credentials.js`](../server/features/accounts/credentials.js): correo, texto y contraseña.
- [`server/utils/request-limit.js`](../server/utils/request-limit.js): contador compartido en PostgreSQL.
- [`server/features/cart/cart-http.js`](../server/features/cart/cart-http.js): `requireCartOrigin`.
- [`tests/accounts/registration.test.mjs`](../tests/accounts/registration.test.mjs) y [`tests/accounts/credentials.test.mjs`](../tests/accounts/credentials.test.mjs): validaciones y JWT.
- [`tests/database/accounts.test.mjs`](../tests/database/accounts.test.mjs): registro, duplicados, sesiones, propiedad y revocación.
- [`scripts/check-accounts-http.mjs`](../scripts/check-accounts-http.mjs): comprobaciones HTTP, solo contra base de pruebas aislada.

**Frase para exponer:** “Validamos tanto en la interfaz como en el servidor y PostgreSQL. La interfaz ayuda al usuario; el servidor y la base hacen cumplir las reglas aunque se modifique el navegador.”

## 6. Preferencia de tema asociada al usuario

### Cómo está implementada

El selector está dentro de **Mi cuenta → Apariencia** y ofrece Claro, Oscuro y Del sistema. `User.themePreference` guarda la elección en PostgreSQL; no se usa localStorage ni una cookie de tema. Las cuentas existentes y nuevas comienzan con `system`.

El formulario envía `PATCH /api/account/theme`. El servidor exige sesión, valida Origin y admite únicamente `light`, `dark` o `system`. Obtiene el usuario desde la sesión, por lo que no permite elegir un dueño distinto desde el formulario. La base tiene una restricción CHECK adicional.

La consulta de sesión devuelve la preferencia. `app/app.vue` la aplica al atributo `data-theme` del HTML desde el renderizado del servidor. La configuración guardada se aplica al iniciar sesión, navegar o recargar; al cerrar sesión se vuelve al sistema. Los tokens CSS mantienen los colores de toda la tienda. En modo sistema, CSS sigue la apariencia de cada dispositivo.

### Cómo mostrarlo en la plataforma

1. Iniciar sesión en `/cuenta`, localizar Apariencia, elegir Oscuro y pulsar Guardar apariencia.
2. Navegar al catálogo y recargar: la apariencia continúa.
3. Iniciar sesión con la misma cuenta en otro navegador o ventana privada: se recupera la elección guardada.
4. Elegir Del sistema y guardar; cambiar el tema del sistema operativo para demostrar que se adapta.
5. Cerrar sesión y comprobar que se sigue el sistema. Otra cuenta mantiene una elección independiente.
6. En F12 → Red, observar `PATCH /api/account/theme` con el valor seleccionado. La consulta de sesión muestra `user.themePreference`. No mostrar valores de cookies en evidencias.

### Preguntas y respuestas

- **¿Por qué guardar el tema en la base?** Para asociarlo a la cuenta y recuperarlo desde distintos dispositivos, sin depender del almacenamiento de un navegador.
- **¿Del sistema significa guardar el color del sistema operativo?** No. Se guarda la opción `system`; cada dispositivo resuelve el color con su propia configuración.
- **¿Se actualizan al instante otros dispositivos que ya estaban abiertos?** No. Recuperan el cambio al volver a consultar la sesión o recargar; no hay sincronización en tiempo real.
- **¿Se conserva el tema elegido por un invitado?** Los invitados siguen el sistema y no tienen un selector persistente. La elección manual requiere cuenta.

### Código de referencia

- [`app/features/appearance/ThemeControl.vue`](../app/features/appearance/ThemeControl.vue): formulario de apariencia.
- [`app/app.vue`](../app/app.vue): consulta compartida de sesión y tema global SSR.
- [`server/features/accounts/account-repository.js`](../server/features/accounts/account-repository.js): método `updateTheme`.
- [`shared/features/accounts/theme-preference.js`](../shared/features/accounts/theme-preference.js): valores permitidos.
- [`prisma/migrations/20261015190000_account_theme_preference/migration.sql`](../prisma/migrations/20261015190000_account_theme_preference/migration.sql): columna y restricción.
- [`docs/theme-preference.md`](theme-preference.md): alcance y comprobaciones. Se verificó persistencia y SSR; queda pendiente el recorrido visual/interactivo del selector.

**Frase para exponer:** “La apariencia es una preferencia de la cuenta almacenada en PostgreSQL. Se recupera al iniciar sesión en cualquier dispositivo y puede ser clara, oscura o seguir el sistema.”

## 7. Gestión de productos — Product Management

Esta sección se revisó mediante lectura del código. Los recorridos siguientes explican cómo demostrar la implementación; no constituyen una nueva comprobación visual. Para una demostración con datos, utilizar información comercial documentada o un entorno de pruebas con productos identificados como sintéticos. No crear productos ficticios como registros comerciales reales.

### Estado de los requisitos

| Requisito | Implementación y alcance actual |
| --- | --- |
| Product creation | Alta administrativa de borrador con una variante; importador local para productos nuevos con medios y más información documentada |
| Product modification | Edición web de nombre, descripción y precio; publicación/retiro y API con campos adicionales. No es un editor completo de todos los atributos |
| Product deletion | Baja lógica mediante desactivación; conserva producto, variantes, referencias e historial. No hay borrado físico en el panel |
| Inventory management | Almacén inicial, lotes, consulta de saldos y ajustes con ledger, permisos e idempotencia |
| Product search or filtering | Buscador y filtros del catálogo público, ordenamiento y paginación. No hay buscador en el listado de administración |

### 7.1. Creación de productos — Product creation

#### Cómo está implementada

1. En `/admin` → **Productos**, el formulario **Crear producto en borrador** envía `POST /api/admin/catalog`.
2. El servidor exige una sesión ADMIN activa y Origin propio. Valida nombre, descripción, slug, motivo y variantes.
3. Una variante identifica una presentación concreta: tiene SKU, sabor, presentación, cantidad/unidad de contenido, precio en centavos y peso/dimensiones para logística.
4. Prisma crea `Product` y `ProductVariant` en una transacción, junto con un `AuditEvent` que identifica al administrador y el motivo.
5. El nuevo producto queda sin `publishedAt`: es borrador y no aparece en el catálogo de clientes.

El formulario web crea una variante. El caso de uso acepta de 1 a 100 variantes por alta, pero no existe en el formulario un control para agregar más de una. Slug y SKU tienen restricciones únicas en la base; un conflicto aborta el alta completa.

#### ¿Qué se valida para evitar duplicados al crear un borrador?

| Identificador | Regla actual |
| --- | --- |
| Slug del producto | `Product.slug` es único en toda la tabla; el servidor exige minúsculas, números y guiones |
| SKU de variante | `ProductVariant.sku` es único en toda la tabla; el servidor exige mayúsculas, números y los separadores permitidos `.`, `_`, `-` |
| Sabor y presentación dentro del mismo producto | Restricción única compuesta por `productId`, `flavorNormalized` y `presentationNormalized`; ambos textos se recortan y pasan a minúsculas para comparar |

La protección definitiva está en las restricciones únicas de PostgreSQL, no en una consulta previa del navegador. Si dos peticiones compiten por el mismo identificador, no pueden guardar ambas. Prisma informa `P2002` y la API responde **409** con **“Identificador comercial ya registrado.”** La transacción revierte el producto, sus variantes y la auditoría de esa operación, sin dejar un alta parcial.

Las restricciones también incluyen borradores y productos/variantes desactivados. No se libera su identidad comercial al retirarlos del catálogo.

**Límite importante:** el nombre y la descripción no son únicos. Dos registros con el mismo nombre pueden crearse si usan slug y SKU diferentes; no hay detección automática de productos equivalentes ni de nombres parecidos. La normalización de sabor/presentación no elimina acentos ni unifica unidades o espacios interiores. El formulario solo crea una variante, pero la restricción compuesta protege las altas con varias variantes y la integridad del modelo.

**Demostración:** en un entorno de pruebas, crear un borrador y volver a intentar el alta con el mismo slug; después, con un slug distinto y el mismo SKU. Ambas operaciones deben mostrar el conflicto y no añadir otro producto. En F12 → Red, revisar el 409 de `POST /api/admin/catalog`. No hace falta publicar el producto para comprobar la restricción.

**Aviso anticipado en el formulario:** al escribir slug o SKU, se espera una pausa de 400 ms y se consulta `POST /api/admin/catalog/check`; salir del campo también permite comprobarlo. El endpoint requiere ADMIN y Origin propio y devuelve únicamente si los identificadores ya existen, incluyendo borradores y bajas lógicas. El aviso aparece debajo del campo con error accesible y bloquea Crear borrador mientras hay conflicto o una consulta pendiente. Si falla la consulta, no se afirma disponibilidad: aparece Reintentar comprobación. Se descartan respuestas antiguas para que no sustituyan el resultado del texto actual.

Antes del alta se realiza una consulta nueva. Aun así, la escritura conserva sus restricciones únicas: otro administrador podría registrar el mismo identificador entre consulta y alta. Si falla el guardado, el formulario conserva los datos y vuelve a comprobar los identificadores. La combinación sabor/presentación no se consulta globalmente: puede repetirse en otros productos y el alta web solo contiene una variante nueva. Su alcance se explica junto al campo Presentación y su restricción compuesta sigue vigente en la base.

Para mostrar el aviso anticipado, escribir un slug o SKU existente y esperar brevemente: debe aparecer el mensaje sin enviar el alta. Cambiarlo por uno libre elimina el conflicto tras comprobarlo. Las consultas de comprobación usan 200 con indicadores booleanos; el 409 corresponde al intento efectivo de guardar un duplicado. Esta funcionalidad se verificó con pruebas de respuestas desordenadas y errores de red simulados, además de pruebas PostgreSQL de permisos, identificadores existentes/libres, registros desactivados y rollback del alta. El recorrido visual/interactivo en navegador queda pendiente.

**Respuesta para exponer:** “Evitamos duplicados mediante un slug único por producto, un SKU único por variante y una combinación única de sabor y presentación dentro del producto. PostgreSQL hace cumplir esas reglas y cualquier conflicto revierte toda el alta. El nombre por sí solo no determina un duplicado.”

El importador local `npm.cmd run catalog:import -- ruta.json` valida un manifiesto sin escribir y, con `--apply`, crea productos nuevos con categorías, imágenes revisadas, variantes y lotes documentados. No es un cargador de imágenes del panel y no sobrescribe productos ya existentes.

#### Cómo mostrarlo

1. Iniciar sesión como ADMIN y abrir http://localhost:3001/admin.
2. Seleccionar **Productos** → **Crear producto en borrador**.
3. Explicar los campos: el precio se captura en pesos, por ejemplo `150.00`; internamente se envía como `15000` centavos. Las medidas se ingresan en gramos y milímetros.
4. En un entorno de prueba, completar el formulario con datos sintéticos identificados y un SKU/slug únicos; indicar un motivo y pulsar **Crear borrador**.
5. Comprobar que aparece en el listado administrativo con estado **Borrador**.
6. Abrir `/catalogo`: el borrador no aparece públicamente. No confundir esto con un fallo de creación.

#### Preguntas y respuestas

- **¿Producto y variante son lo mismo?** No. El producto agrupa la información general; cada variante representa una combinación de sabor/presentación con SKU, precio y características propias.
- **¿Crear equivale a publicar?** No. La publicación es una operación separada.
- **¿Por qué no se publica inmediatamente?** Para revisar el contenido. El servidor exige al menos una variante activa y una imagen frontal registrada antes de publicar.
- **¿Puedo cargar imágenes a un borrador ya creado?** Sí. En Productos → Gestionar → Imágenes se puede elegir un archivo JPG, PNG o WebP de hasta 5 MB, tipo (frontal, nutricional o galería), descripción accesible y motivo. Guardar imagen adjunta el archivo al producto existente sin recrearlo. Una imagen frontal permite completar el requisito de publicación. El importador sigue siendo una herramienta para productos nuevos, no para sobrescribir borradores.

#### Código de referencia

- [`app/features/administration/ProductsAdministration.vue`](../app/features/administration/ProductsAdministration.vue): formulario y función `create`.
- [`server/features/administration/manage-store.js`](../server/features/administration/manage-store.js): `createDraft`, `variantData` y `audit`.
- [`server/features/catalog/import-catalog.js`](../server/features/catalog/import-catalog.js) y [`docs/catalog-import.md`](catalog-import.md): importación local.

**Frase para exponer:** “El administrador crea productos con sus variantes en una transacción. El alta queda en borrador, conserva auditoría y requiere una publicación explícita.”

#### Cómo completar un borrador con imágenes

En `/admin` → Productos → Gestionar → Imágenes, seleccionar un JPG, PNG o WebP (máximo 5 MB), elegir Frontal/Nutricional/Galería y completar descripción accesible y motivo. Guardar imagen conserva el producto existente y actualiza la lista. Para publicar, indicar el motivo del cambio en la edición del producto y pulsar Publicar. Una carga no publica automáticamente ni agrega stock.

**Si Publicar no está habilitado:** el motivo de carga de la imagen no completa el campo Motivo de los cambios de la edición. Llenar este último y pulsar Guardar y publicar directamente: se aplican los cambios y la publicación juntos. El panel muestra junto a los botones qué requisito falta (motivo, imagen frontal o variante activa) o si el producto está desactivado.

El servidor verifica ADMIN/Origin, decodifica la imagen con sharp y la vuelve a codificar como WebP, con un máximo de 2000 × 2000 y límite de 25 millones de píxeles de entrada. Guarda el archivo en un directorio persistente y los metadatos/asociación en `MediaAsset`/`ProductMedia`, junto con auditoría. Los archivos de la carga web de borradores solo se sirven a administradores; publicados, se muestran en el catálogo y la galería. Otra frontal desplaza la anterior a Galería sin eliminarla. Máximo 20 imágenes por producto.

Para mostrar persistencia, recargar la edición y observar las imágenes guardadas. Para mostrar el resultado público, publicar el producto de prueba y abrir su detalle. La comprobación automatizada HTTP ya recorrió carga y publicación; el recorrido visual del selector sigue pendiente en esta sesión. Más detalle en [`docs/product-images.md`](product-images.md). La carga no asigna imágenes a variantes específicas; no hay eliminación ni edición de metadatos de imágenes guardadas en este formulario.

- **¿Las imágenes están en un volumen Docker y en carpetas por producto?** Están en el volumen `fitness-stuff-local_catalog_images`, montado en `/app/catalog-uploads`, pero no hay subcarpetas por producto. Se guardan como archivos WebP con nombres UUID. La relación con el producto se resuelve en PostgreSQL mediante `ProductMedia` y `MediaAsset`; no depende del nombre de la carpeta. Se deben conservar tanto el volumen de archivos como la base de datos.

### 7.2. Modificación de productos — Product modification

#### Cómo está implementada

En el listado administrativo, **Gestionar [nombre]** abre la edición. La interfaz permite:

- Editar nombre, slug, descripción y clasificación del producto.
- Editar todos los campos de las variantes capturados en el alta: SKU, sabor, presentación, cantidad/unidad de contenido, precio, peso y dimensiones. Se muestra también el precio anterior opcional.
- Usar **Guardar cambios** para persistir sin cerrar la edición o **Guardar y publicar** para guardar todos los cambios y publicar de forma atómica. El motivo histórico del alta se muestra como información; cada nueva operación exige su propio motivo.

`PATCH /api/admin/catalog/:id` delega a `updateProduct` y acepta cambios generales, categorías y una lista de variantes existentes modificadas. Dentro de la misma transacción valida pertenencia, permisos, versiones e identificadores únicos. La interfaz envía `expectedUpdatedAt` del producto y `expectedPriceVersion` por variante modificada; una versión obsoleta devuelve 409. Un conflicto revierte toda la operación. Ingredientes, alérgenos e instrucciones siguen disponibles por API, sin editor en este panel.

`PATCH /api/admin/variants/:id` conserva el acceso individual a cambios de variante mediante el mismo caso de actualización, `changeVariant`. El formulario web utiliza el guardado conjunto para evitar publicar datos de variante que se hayan editado pero todavía no guardado.

Los importes se almacenan como enteros `BigInt` en centavos y viajan como texto por la API. El servidor rechaza precios negativos y un precio anterior que no sea mayor que el vigente. Los cambios generan auditoría dentro de la transacción.

#### Cómo mostrarlo

1. En `/admin` → **Productos**, pulsar **Gestionar** sobre un producto de prueba.
2. Revisar los datos precargados y modificar nombre, slug y los campos de la variante que se necesiten, usando solo datos de prueba en la demostración.
3. Elegir **Tipo de suplemento / categoría principal**. Si no existe el tipo, crearlo con nombre, slug y motivo en **Tipos de suplemento y categorías**; después seleccionarlo.
4. Llenar **Motivo de los cambios** y pulsar **Guardar cambios**. La edición sigue abierta con los datos guardados; recargar confirma la persistencia.
5. Con imagen frontal y variante activa, usar **Guardar y publicar** para aplicar modificaciones y hacer visible el producto. Comprobar en el catálogo y en sus filtros de categoría.
6. En F12 → Red, revisar el PATCH conjunto con la versión del producto y las versiones de variantes modificadas. Un conflicto debe conservar los datos del formulario para revisarlos o usar Actualizar producto y descartar cambios.

#### Preguntas y respuestas

- **¿Qué ocurre si dos administradores editan el mismo precio?** Se valida `expectedPriceVersion` bajo bloqueo. La segunda escritura con una versión obsoleta se rechaza y debe recargar los datos.
- **¿Por qué centavos?** Para representar dinero con enteros y evitar errores de redondeo de valores decimales binarios en las reglas monetarias.
- **¿Se puede editar todo lo capturado al crear el borrador?** Los datos comerciales y medidas del alta sí; el motivo original se conserva como historial y las correcciones llevan un motivo nuevo. También se pueden crear/asignar tipos de suplemento mediante categorías. No se editan aquí los datos nutricionales avanzados, nombres de categorías existentes ni metadatos de imágenes guardadas.
- **¿Dónde se clasifica por tipo de suplemento?** En Clasificación del producto → Tipo de suplemento / categoría principal, disponible al crear y editar. Usa `Category`/`ProductCategory`, sin un catálogo paralelo. Se pueden añadir categorías adicionales y la clasificación alimenta los filtros públicos. No se crean tipos por defecto: los registra el administrador según su catálogo.
- **¿Se modifican las compras anteriores al cambiar un nombre o precio?** Los pedidos conservan snapshots de sus líneas e importes; no se reescriben por editar el catálogo.

#### Código de referencia

- [`app/features/administration/ProductsAdministration.vue`](../app/features/administration/ProductsAdministration.vue): `select` y `update`; [`CategorySelection.vue`](../app/features/administration/CategorySelection.vue) y [`CategoryManager.vue`](../app/features/administration/CategoryManager.vue): clasificación y alta de tipos.
- [`server/features/administration/manage-store.js`](../server/features/administration/manage-store.js): `updateProduct`, `changeVariant`, `assignCategories` y `createCategory`.
- [`prisma/schema.prisma`](../prisma/schema.prisma): `Product`, `ProductVariant` y snapshots de `OrderLine`.

**Frase para exponer:** “La edición valida permisos y motivo, conserva auditoría y utiliza una versión de precio para evitar sobrescrituras concurrentes.”

### 7.3. Eliminación de productos — Product deletion

#### Cómo está implementada

Se utiliza **baja lógica (soft delete)**. **Desactivar producto** envía un PATCH con `deactivate: true` y `published: false`. El servidor guarda la fecha en `Product.deletedAt`, retira la publicación y registra auditoría. No ejecuta un DELETE físico.

El catálogo público exige `deletedAt: null` y publicación vigente, por lo que el producto desactivado desaparece de la oferta pública. La administración todavía lo lista como **Desactivado** y sus controles de edición quedan deshabilitados. Las variantes y referencias históricas se conservan; el SKU y el slug siguen ocupados.

Retirar la publicación y desactivar son operaciones distintas: retirar mantiene el producto como borrador; desactivar registra la baja. No existe un flujo de reactivación en este panel.

#### Cómo mostrarlo

1. Utilizar un producto de prueba destinado a la demostración, porque no hay botón para reactivarlo.
2. En `/admin` → **Productos** → **Gestionar**, ingresar un motivo y pulsar **Desactivar producto**.
3. Mostrar que permanece en administración con estado **Desactivado**.
4. Si estaba publicado, recargar `/catalogo` y comprobar que ya no aparece. Su URL pública deja de devolverlo como producto disponible.
5. Explicar que el registro y las referencias de pedidos se conservan; no desaparecen de la base.

#### Preguntas y respuestas

- **¿Cumple eliminación aunque el registro siga en la base?** Implementa eliminación lógica de la oferta. Debe explicarse así; si la rúbrica exige expresamente borrado físico, ese comportamiento no está implementado.
- **¿Por qué conservarlo?** Para mantener trazabilidad y referencias de compras e inventario.
- **¿Puedo volver a crear el mismo SKU tras desactivarlo?** No. La unicidad se mantiene para evitar reutilizar la identidad comercial de otro registro.
- **¿Desactivar borra o devuelve existencias?** No. El inventario conserva sus lotes y movimientos; una baja de catálogo no equivale a un ajuste físico de almacén.

#### Código de referencia

- [`app/features/administration/ProductsAdministration.vue`](../app/features/administration/ProductsAdministration.vue): acción **Desactivar producto**.
- [`server/features/administration/manage-store.js`](../server/features/administration/manage-store.js): `updateProduct`.
- [`server/features/catalog/catalog-repository.js`](../server/features/catalog/catalog-repository.js): filtro `published` aplicado a listados y detalle públicos.
- [`tests/database/administration.test.mjs`](../tests/database/administration.test.mjs): baja histórica conservando variantes y categorías.

**Frase para exponer:** “La eliminación es lógica: retiramos el producto del catálogo mediante una fecha de baja y conservamos el historial comercial.”

### 7.4. Gestión de inventario — Inventory management

#### Cómo está implementada

El inventario se organiza por **variante/SKU, almacén y lote**. `InventoryLot` registra caducidad, bloqueo y saldos; `InventoryMovement` conserva los movimientos que explican esos saldos.

En `/admin` → **Inventario** se puede:

- Configurar el almacén inicial con datos documentados si no existe.
- Registrar un lote por SKU, almacén, código, caducidad opcional y motivo. Incluye la cantidad inicial en piezas; admite 0 si no hay existencias.
- Consultar existencias, reservadas y no vendibles, así como caducidad y bloqueo.
- Ajustar un lote con cantidad positiva para entradas o negativa para salidas y un motivo obligatorio.

El ajuste se realiza mediante un movimiento `ADJUSTMENT` del ledger. Un trigger de PostgreSQL actualiza la proyección del lote; el formulario no escribe directamente los contadores. La operación bloquea el lote y no permite retirar piezas reservadas ni producir un saldo inválido.

Cada ajuste lleva `idempotencyKey`: repetir la misma operación con la misma clave devuelve el movimiento previo en vez de duplicarlo. Usar la clave con otros datos genera un conflicto.

Para la disponibilidad pública se excluyen lotes bloqueados o vencidos y se suman las piezas vendibles menos las reservadas. En este modelo, `onHandQty` ya representa las piezas físicas vendibles; `nonSellableQty` es un saldo separado y no se resta una segunda vez. El módulo de reservas aplica **FEFO**: primero los lotes que caducan antes. Agregar al carrito no equivale a reservar inventario.

#### Cómo mostrarlo

1. Abrir `/admin` → **Inventario** con una cuenta ADMIN.
2. Si falta el almacén, mostrar su formulario; no inventar una dirección comercial para completar la exposición.
3. Con un SKU y almacén de prueba existentes, usar **Registrar lote** y indicar la cantidad inicial y comprobar que aparece como existencias.
4. Pulsar **Ajustar lote**, ingresar una entrada, por ejemplo `5`, con motivo identificado como prueba y guardar.
5. Comprobar que las existencias aumentan. Una salida `-2` reduce el saldo en dos piezas.
6. Intentar retirar más piezas de las disponibles para mostrar que la operación se rechaza; no fuerza un stock negativo.
7. Si el producto está publicado y el lote es vendible, observar su disponibilidad en el catálogo. Un lote vencido o bloqueado no aporta disponibilidad vendible.

Las reservas y la concurrencia se explican mediante las pruebas aisladas: el listado web muestra las cantidades, pero un ajuste manual no demuestra por sí solo todo el flujo de compra ni la selección FEFO.

#### Preguntas y respuestas

- **¿Por qué lotes en vez de un único número por producto?** Para distinguir caducidades, almacén y trazabilidad de las existencias de cada SKU.
- **¿Para qué sirve Registrar lote?** Para identificar un grupo concreto de unidades de una variante/SKU en un almacén. Dos grupos del mismo SKU pueden tener códigos y caducidades distintos y deben conservar sus saldos por separado. En esta plataforma registrar el lote permite capturar las existencias iniciales; después se usa Ajustar lote para las siguientes entradas o salidas con su motivo. No se crea otro producto ni se duplica su SKU. La combinación variante + almacén + código de lote es única. El código debe corresponder al grupo físico documentado, no inventarse como información comercial.
- **¿Cómo explico los lotes con un ejemplo?** Ejemplo exclusivamente ilustrativo: una variante tiene un lote A con 10 piezas que caducan en junio y otro lote B con 20 piezas que caducan en septiembre. Ambos pertenecen al mismo SKU, pero sus existencias y caducidades se administran por separado. Su disponibilidad sería 30 piezas únicamente si todos esos lotes siguen vigentes, están desbloqueados y no tienen reservas. FEFO prioriza las piezas del lote con caducidad más próxima al asignar inventario a una reserva, no al pulsar Registrar lote.
- **¿Cómo se elige el estado del almacén?** El formulario muestra un selector **Estado** con las 32 entidades federativas. El administrador elige el nombre y se guarda el código de dos letras que utiliza Envia.com en `Warehouse.state`; por ejemplo, San Luis Potosí → `SL`, Ciudad de México → `CX`. No es un estado operativo como activo/inactivo. El servidor valida que el código pertenezca al mismo catálogo: no basta con introducir dos letras cualesquiera. Ya no se captura manualmente un código de hasta tres caracteres.
- **¿Dónde se consultan y editan los datos del almacén?** En `/admin` → Inventario → **Información del almacén**. La ficha muestra nombre, remitente, contacto, teléfono, dirección, referencias y zona horaria. **Editar almacén** abre un formulario precargado con los datos guardados; permite corregir nombre, contacto y dirección, con estado mediante selector e interior/referencias opcionales. Exige motivo de los cambios. País y zona horaria son informativos y no se editan aquí.
- **¿Qué son las piezas reservadas?** Piezas comprometidas temporalmente en un proceso de compra que no deben ofrecerse dos veces.
- **¿Qué es un ledger?** Un registro de movimientos que permite explicar cómo se llegó al saldo actual.
- **¿Qué impide contar dos veces un ajuste reenviado?** La clave de idempotencia, única en la base y verificada contra los datos de la operación.
- **¿Desde el panel puedo bloquear lotes o editar certificados?** No en la interfaz actual. Consulta bloqueo y saldos, registra lotes y realiza ajustes; no es un editor completo de todos los atributos logísticos.

#### Código de referencia

- [`app/features/administration/InventoryAdministration.vue`](../app/features/administration/InventoryAdministration.vue): formularios y listado.
- [`server/features/administration/manage-store.js`](../server/features/administration/manage-store.js): `configureWarehouse`, `createLot`, `adjustStock` y `overview`.
- [`server/features/inventory/adjust-inventory.js`](../server/features/inventory/adjust-inventory.js): ajuste, bloqueo e idempotencia.
- [`shared/features/inventory/availability.js`](../shared/features/inventory/availability.js), [`lots.js`](../shared/features/inventory/lots.js) y [`fefo.js`](../shared/features/inventory/fefo.js): disponibilidad y FEFO.
- [`tests/database/inventory.test.mjs`](../tests/database/inventory.test.mjs) y [`tests/database/administration.test.mjs`](../tests/database/administration.test.mjs): pruebas de inventario y administración.

**Frase para exponer:** “El inventario se administra por SKU y lote mediante movimientos trazables. Los ajustes son transaccionales, no duplican operaciones y respetan las piezas reservadas.”

#### Selector de estados del almacén: implementación y demostración

El catálogo compartido está en [`shared/features/shipping/mexican-states.js`](../shared/features/shipping/mexican-states.js). Sus nombres y `code_2_digits` se verificaron el 15 de octubre de 2026 mediante el [endpoint oficial de estados](https://queries.envia.com/state?country_code=MX), tanto en producción como en pruebas. Envia recomienda utilizar sus propios códigos, que pueden diferir de ISO o de otras plataformas: [documentación oficial de consultas](https://docs.envia.com/reference/states-by-country).

Se conserva una copia local de estos datos públicos para que el formulario no dependa de la red ni de credenciales del proveedor. `InventoryAdministration.vue` utiliza los nombres como etiquetas y los códigos como valores del select. `configureWarehouse` usa `isMexicanStateCode` para validar en servidor antes de guardar. No hay migración de esquema ni conversión automática de almacenes existentes.

Para mostrarlo, entrar como ADMIN en `/admin` → Inventario → Configurar almacén inicial (solo aparece si todavía no existe almacén). Abrir **Estado**, elegir San Luis Potosí y observar en F12 → Red que el alta envía `state: "SL"`. Guardar únicamente cuando se cuente con los datos reales del almacén o se utilice un entorno de prueba. La selección y validación no equivalen a verificar que el domicilio exista ni a obtener una cotización real.

Las pruebas comprueban 32 códigos únicos, compatibilidad de todos con el formato de direcciones de la integración, guardado de `SL` y rechazo de `ZZ`, `SLP` y `CDMX`. La revisión visual/interactiva del selector queda pendiente en esta sesión.

#### Consulta y edición del almacén: implementación y demostración

`GET /api/admin/inventory` devuelve los datos de la ficha únicamente después de autorizar una cuenta ADMIN. [`WarehouseInformation.vue`](../app/features/administration/WarehouseInformation.vue) presenta la información y copia los valores al formulario al pulsar Editar almacén. Cancelar descarta la edición visual sin enviar cambios; un fallo de guardado conserva el formulario y muestra el error.

El formulario envía `PATCH /api/admin/warehouse` con los campos permitidos, el motivo y `expectedConfigurationVersion`. `updateWarehouse` valida los datos, revalida ADMIN, bloquea la fila y compara la versión en una transacción. Si otra operación ya guardó cambios, responde 409. Actualizar información vuelve a consultar los datos para iniciar una nueva edición. Una escritura válida incrementa `configurationVersion` y registra `UPDATE_WAREHOUSE` en auditoría con administrador, motivo y campos modificados.

La versión forma parte de la huella calculada en `prepareShipping`: al cambiar el origen, las cotizaciones de carrito anteriores dejan de coincidir y se debe cotizar de nuevo. No se reescriben las direcciones de origen guardadas en los pedidos existentes, ni se modifica inventario por editar la dirección. No se requiere una migración nueva porque la versión y los campos ya existían en el modelo.

Para demostrarlo: entrar a Inventario, mostrar la ficha, pulsar Editar almacén, cambiar un dato en un entorno de pruebas, completar Motivo de los cambios y guardar. La ficha se actualiza; recargar confirma la persistencia. Para demostrar concurrencia, abrir la edición en dos pestañas con la misma versión, guardar en una y luego intentar guardar en la otra: la segunda operación debe solicitar actualizar la información. No es necesario cambiar la dirección comercial real durante la exposición.

Código: [`warehouse-fields.js`](../app/features/administration/warehouse-fields.js) comparte los campos de alta/edición; [`manage-store.js`](../server/features/administration/manage-store.js), `overview`, `warehouseData` y `updateWarehouse`; [`shipping-quotes.js`](../server/features/shipping/shipping-quotes.js), `prepareShipping`. Las pruebas de administración cubren lectura completa, permisos, validación de estado/versión, dos actualizaciones concurrentes, auditoría, rechazo de una cotización antigua, generación de una nueva y conservación del snapshot de un pedido. La revisión visual/interactiva de la nueva ficha sigue pendiente.

### 7.5. Búsqueda y filtros — Product search or filtering

#### Cómo están implementados

El buscador de la cabecera lleva al catálogo público `/catalogo` con el parámetro `q`. El servidor busca coincidencias parciales en **nombre del producto, SKU de variante y nombre de categoría**, normalizando mayúsculas y acentos. No implementa búsqueda aproximada por errores tipográficos ni búsqueda semántica.

La consulta usa parámetros SQL y escapa los comodines `%` y `_` para que se traten como texto. La búsqueda admite hasta 120 caracteres y rechaza caracteres de control. La lectura pública excluye borradores y productos/variantes desactivados.

El catálogo ofrece filtros por:

- Categoría, objetivo y disciplina.
- Disponibilidad: disponible o agotado.
- Presentación.
- Precio mínimo y máximo en MXN.
- Costo por porción: menos de $15, de $15 a $30 o más de $30 MXN, cuando existen datos de porciones.

Dentro de un grupo, las opciones se combinan como alternativas; entre grupos deben cumplirse las condiciones correspondientes. Los filtros de precio, presentación y disponibilidad deben coincidir en la **misma variante**, evitando aceptar un producto por mezclar atributos de variantes diferentes.

Los filtros y el orden están en la URL. Cambiar la búsqueda, filtros u orden reinicia la página; recargar o compartir la URL conserva los criterios. Hay chips para quitar filtros y opciones para limpiarlos. El orden permite relevancia, precio, costo por porción y novedades. La relevancia es una regla del código, no un servicio de IA.

La búsqueda se ejecuta en PostgreSQL; los filtros y la paginación se calculan en el servidor sobre los resultados leídos. Hay un límite de lectura de 10 000 productos: para un catálogo mayor haría falta adaptar la consulta e índices. No debe afirmarse que toda la búsqueda, filtrado y paginación se resuelve mediante índices SQL.

#### Cómo mostrarlo

1. Abrir http://localhost:3001/catalogo. No requiere iniciar sesión.
2. En la cabecera, buscar un nombre, SKU o categoría que exista en el catálogo publicado y pulsar Enter.
3. Si existe un nombre con acentos, buscarlo sin acentos para mostrar la normalización.
4. Marcar Disponible o Agotado y aplicar un rango de precio. Mostrar los filtros activos y el cambio de URL.
5. Cambiar **Ordenar por** y usar paginación si hay suficientes productos.
6. Recargar: se mantienen los criterios de la URL. Quitar un chip o usar **Limpiar filtros** para revertirlos.
7. Buscar un término inexistente: se muestra el estado sin coincidencias. Si no hay productos publicados, se muestra **Todavía no hay productos publicados**; esto no demuestra resultados reales de búsqueda.
8. En F12 → Red se puede revisar `GET /api/catalog/products` con sus parámetros. Las categorías, objetivos, disciplinas y presentaciones dependen del catálogo disponible; los grupos sin opciones se ocultan.

#### Preguntas y respuestas

- **¿Solo filtra tarjetas que ya estaban cargadas en el navegador?** No. La interfaz consulta la API y el servidor obtiene, busca y filtra los datos.
- **¿También encuentra productos no publicados?** No. La lectura pública aplica las condiciones de publicación y baja lógica.
- **¿Buscar y filtrar es lo mismo?** Buscar compara texto; filtrar restringe atributos estructurados. Se pueden combinar.
- **¿Hay buscador en la administración?** No. Estas funciones están en el catálogo público; administración dispone de listado paginado.
- **¿Qué ocurre si no hay datos de porciones?** No se inventan. Una variante sin información para calcular el costo por porción no cumple ese filtro.

#### Código de referencia

- [`app/components/SiteHeader.vue`](../app/components/SiteHeader.vue): formulario y navegación de búsqueda.
- [`app/features/catalog/CatalogListing.vue`](../app/features/catalog/CatalogListing.vue) y [`CatalogFilters.vue`](../app/features/catalog/CatalogFilters.vue): resultados, filtros y URL.
- [`server/features/catalog/catalog-repository.js`](../server/features/catalog/catalog-repository.js): `list`, `browse` y filtro `published`.
- [`shared/features/catalog/search.js`](../shared/features/catalog/search.js), [`filters.js`](../shared/features/catalog/filters.js) y [`pagination.js`](../shared/features/catalog/pagination.js): reglas de búsqueda, filtros y orden.
- [`tests/database/catalog-search.test.mjs`](../tests/database/catalog-search.test.mjs), [`tests/catalog/search.test.mjs`](../tests/catalog/search.test.mjs) y [`tests/catalog/filters.test.mjs`](../tests/catalog/filters.test.mjs): pruebas de coincidencia, entradas y combinación de filtros.

**Frase para exponer:** “El catálogo permite buscar por nombre, SKU o categoría y combinar filtros de disponibilidad, presentación y precio. Los criterios se conservan en la URL y solo se muestran productos publicados y activos.”

## Alcance pendiente de cuentas que conviene reconocer

- Verificación de propiedad del correo y recuperación de contraseña por correo.
- Revisión visual de la renovación automática en navegador.
- Inicio de sesión con proveedores externos y doble factor.
- Validación de formato telefónico, verificación por SMS y comprobación física de direcciones.
- Política de contraseña más allá de los límites actuales de longitud y confirmación.

Estos pendientes no deben presentarse como implementados. La autenticación actual sí incluye contraseña con hash, JWT firmado, sesión persistida, renovación rotativa, revocación y autorización por rol.
