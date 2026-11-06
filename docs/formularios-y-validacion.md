# Mensajes de validación de formularios

Los 36 formularios versionados usan `UiForm`. El formulario de acceso alterna inicio de sesión y registro. El árbol de trabajo incluye además la búsqueda de auditoría (37 formularios en total), que pertenece a otro módulo en desarrollo: su adaptación permanece fuera del commit de validaciones y no da ese módulo por terminado.

## Comportamiento compartido

Al intentar enviar datos incorrectos aparece «No se pudo continuar. Corrige el siguiente campo / los siguientes campos», seguido de los nombres y mensajes de todos los campos que bloquean el envío. Cada mensaje permite enfocar su control; el primero recibe el foco automáticamente. Los errores se actualizan al corregir los datos. `UiField` muestra además el error junto al control. Los controles HTML directos quedan asociados con su mensaje del resumen mediante `aria-describedby` y `aria-invalid`.

Mensajes aplicados según las restricciones reales de cada campo:

- Obligatorio vacío: «[Campo]: completa este campo.»
- Solo espacios: «[Campo]: no uses solo espacios; escribe un valor.»
- Correo: «[Campo]: escribe un correo válido, por ejemplo nombre@dominio.com.»
- Selección obligatoria: «[Campo]: selecciona una opción para continuar.»
- Casilla obligatoria: «[Texto de la casilla]: marca esta casilla para continuar.»
- Archivo obligatorio: «[Campo]: selecciona el archivo que quieres guardar.»
- Longitud: «[Campo]: escribe al menos N caracteres» o «usa como máximo N caracteres».
- Contraseña: máximo 256 bytes, explicando que acentos y emojis pueden ocupar varios bytes, incluso al mostrar la contraseña.
- Números: valor mínimo/máximo concreto, entero sin decimales o incremento permitido.
- Código postal: «escribe exactamente cinco dígitos, por ejemplo 01000».
- Identificador de URL: minúsculas, números y guiones entre palabras, sin espacios, acentos ni guiones iniciales/finales.
- Importe: sin separadores de miles y hasta dos decimales; la conversión indica el nombre del importe incorrecto.
- Porciones: hasta diez dígitos enteros y cuatro decimales con punto, sin ceros adicionales al principio.
- Se preservan los mensajes de validaciones de negocio existentes, como la selección de una variante de la lista.

Los errores de campos se muestran dentro del formulario; no se duplican en avisos flotantes que tapen los controles. Los errores del servidor siguen visibles. Las reglas de negocio permanecen en el servidor y no se reemplazan por estas ayudas de interfaz. No se muestran valores introducidos, contraseñas ni respuestas privadas del proveedor en los mensajes de validación.

## Inventario por formulario

Cada fila recibe los mensajes compartidos que correspondan a sus controles. Los mensajes que ya existían (por ejemplo, credenciales incorrectas o archivo demasiado grande) se conservan; se distinguen aquí de las mejoras específicas de esta tarea.

| Formulario | Mensajes añadidos o precisados |
|---|---|
| Buscar en la cabecera | Nombre del campo y límite de longitud declarado; una búsqueda vacía sigue permitida. |
| Iniciar sesión / registrar cliente | Nombre/correo/contraseña obligatorios, formato de correo, límites y bytes de contraseña; se conservan confirmación de contraseña, correo duplicado y credenciales incorrectas. |
| Editar perfil | Nombre obligatorio y límites de nombre/teléfono. |
| Cambiar contraseña | Contraseña actual y nueva obligatorias; mínimo de 12 caracteres y máximo de 256 bytes. |
| Desactivar mi cuenta | Contraseña de confirmación obligatoria; se conserva la comprobación segura de contraseña actual. |
| Agregar dirección | Identifica destinatario, teléfono, estado, ciudad, colonia, calle y número exterior faltantes; CP de cinco dígitos y límites de cada campo. El servidor usa nombres en español en vez de claves internas. |
| Guardar apariencia | «Este tema ya está guardado. Selecciona otro tema para habilitar Guardar apariencia.» |
| Consultar pedido para posventa | Pedido obligatorio; pide copiar el identificador completo desde el detalle, sin confundirlo con el número comercial. |
| Registrar devolución / Price Match | Seleccionar al menos una unidad; descripción/evidencia obligatorias y enlace que empiece por HTTPS. Se conservan las restricciones comerciales del servidor. |
| Actualizar cantidad del carrito | Campo de cantidad, mínimo, máximo e incrementos enteros; se conserva la explicación del stock disponible. |
| Aplicar cupón en carrito | Código obligatorio para aplicar; la retirada sigue teniendo su propio botón. |
| Crear tipo o categoría | Nombre, identificador y motivo obligatorios; formato concreto del identificador y longitudes. |
| Registrar marca | Nombre, identificador y motivo obligatorios; formato de identificador también explicado por el servidor. |
| Crear producto en borrador | Identifica cada dato y motivo faltante, precio, porciones y límites; servidor precisa SKU, contenido, peso y eje de la medida incorrecta. |
| Buscar productos en administración | Límite del campo de búsqueda; vaciarlo sigue limpiando el filtro. |
| Editar / publicar producto | Identifica los campos faltantes y el SKU/precio incorrecto de cada presentación; mantiene los requisitos de publicación existentes. |
| Retirar producto de publicación | Motivo de retiro obligatorio y límite de longitud. |
| Reactivar producto | Motivo de reactivación obligatorio y límite de longitud. |
| Agregar presentación | Datos, medidas y motivo obligatorios; precio vigente/anterior identificados; SKU/contenido/medida explicados por el servidor. |
| Cargar imagen | Selección de archivo, tipo de imagen, descripción y motivo obligatorios; explica cuando ya hay 20 imágenes. Conserva las comprobaciones de JPG/PNG/WebP y 5 MB. |
| Registrar administrador | Nombre, correo, contraseñas y motivo obligatorios; formato de correo y límites de contraseña. Se conservan confirmación y duplicado del servidor. |
| Desactivar usuario | Motivo de desactivación obligatorio y longitud máxima. |
| Cambiar estado del pedido | Motivo obligatorio y longitud máxima; conserva las restricciones de transición del servidor. |
| Configurar almacén inicial | Identifica cada dato de origen faltante, selección estatal y CP; límites de cada campo. |
| Editar almacén | Los mismos mensajes de origen, CP y motivo de edición. |
| Registrar lote | Selección válida de presentación, almacén, lote, cantidad inicial y motivo; cantidad entera de 0 a 2147483647; aviso de configurar primero el almacén; fecha de caducidad explícita. |
| Ajustar inventario | «Cantidad del ajuste: escribe un número distinto de cero; positivo para agregar piezas y negativo para retirarlas»; enteros, límites y motivo obligatorio. |
| Editar trazabilidad / certificado | Identifica origen o referencia de aduana con más de 500 caracteres o caracteres de control; fecha de importación existente y motivo obligatorio. Conserva la validación de PDF hasta 20 MB. |
| Agregar / editar caja | Código, medidas y motivo obligatorios; enteros y límites; indica qué eje exterior es menor que el interior. Conserva la validación de peso bruto máximo frente a tara. |
| Crear / editar cupón | Porcentaje entre 0.01 y 100; descuento fijo mayor que cero; importe de compra mínima identificado; fin posterior al inicio; producto/categoría requeridos según alcance; identifica límite global o por cliente incorrecto. |
| Publicar política | Título, contenido, motivo y aprobación obligatorios; límites de texto. Permite intentar enviar para explicar la casilla faltante en vez de bloquear sin mensaje. |
| Registrar interés de reposición | Correo válido y consentimiento obligatorio; permite intentar enviar para explicar qué falta. Conserva el aviso de que el envío de correo no está habilitado. |
| Publicar / editar reseña | Calificación requerida; cuerpo obligatorio, límites de título/cuerpo; conserva elegibilidad por compra entregada. |
| Cotizar envío | Destinatario, teléfono, CP, estado, ciudad y calle identificados; también en los mensajes del proveedor. En checkout incluye correo, colonia y número exterior. |
| Confirmar pedido | Aceptación de políticas e importe obligatoria; conserva validación de tarifa vigente y stock. |
| Filtrar precios del catálogo | Mínimo no negativo e incremento de 0.01; mensajes por campo; conserva la comprobación del rango mínimo/máximo. |
| Buscar en auditoría (módulo en desarrollo) | Mensajes compartidos aplicables a los controles y límites de su búsqueda. |

## Registros que ya existen

Se mantienen las restricciones de unicidad de la base; no se impide repetir datos que el negocio permite, como dos productos con el mismo nombre o varias direcciones de una cuenta. Los errores de PostgreSQL se traducen sin mostrar SQL ni valores de otros registros. Se admiten tanto los metadatos por columnas como los índices que entrega el adaptador pg.

| Registro | Mensaje o indicación |
|---|---|
| Correo de cliente | Ya existe una cuenta con ese correo; iniciar sesión o utilizar otro. Se conserva la comprobación existente en base. |
| Correo de administrador | Ya existe una cuenta con ese correo y no se modificaron sus permisos. |
| SKU | Ya está registrado en otra presentación, aunque esté desactivada; editar la existente o usar otro SKU. |
| URL de producto | Identificador ya registrado; editar el producto existente o usar otro. |
| Nombre / URL de categoría | Identifica el nombre o la URL que ya existe; seleccionar la categoría existente o usar otro dato. |
| Nombre / identificador de marca | Distingue cuál de los dos está registrado; seleccionar la marca existente o utilizar otro identificador. |
| Sabor y presentación | Esa combinación ya existe dentro del mismo producto, aunque esté desactivada; editarla o usar otra combinación. |
| Lote | El código ya existe para esa presentación y almacén; usar Ajustar lote si se recibieron más piezas, sin duplicarlo. |
| Código de caja | Ya existe aunque la caja esté inactiva; editarla o usar otro código. |
| Código de cupón | Ya existe aunque esté vencido o desactivado; no distingue mayúsculas; editarlo o usar otro código. |
| Almacén inicial | Ya está configurado; actualizar la lista y editar el existente. |

## Verificación

- 99 pruebas de cuentas, catálogo, precios y pagos, incluidas seis nuevas de mensajes, validaciones y duplicados, aprobadas.
- Compilación Nuxt aprobada.
- Edge sin interfaz: registro, contraseña visible/bytes, resumen, foco, corrección de campos, direcciones/CP y administrador; escritorio y móvil, APIs simuladas.
- Regresiones de cupones y pasos de compra en navegador con APIs simuladas, aprobadas.
- Capturas de escritorio y móvil revisadas para el modal de dirección. Esto no representa revisión visual de todos los formularios ni pruebas de todas las operaciones contra PostgreSQL real.
- Sin registros, pagos, cotizaciones externas ni cambios en staging/producción durante las comprobaciones. El commit de validaciones excluye el módulo de auditoría en desarrollo y no implica push ni despliegue.

Comandos reproducibles:

```powershell
node --test tests/accounts/*.test.mjs tests/catalog/*.test.mjs tests/pricing/*.test.mjs tests/payments/*.test.mjs
npm.cmd run build
# Con un servidor local y TEST_BROWSER_PATH apuntando a Edge/Chrome:
node scripts/check-form-errors-browser.mjs
node scripts/check-administrator-registration-browser.mjs
node scripts/check-coupons-browser.mjs
node scripts/check-checkout-steps-browser.mjs
```
