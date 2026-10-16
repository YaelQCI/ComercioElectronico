# Guía para explicar y demostrar la plataforma

## Pantalla de pago validado y regreso a la pestaña

En `/pago?pedido=…`, un pago `PAID` con pedido confirmado o posterior muestra **Pago validado**, **¡Gracias por tu compra!** y una marca de verificación animada. Un pedido de total cero confirmado agradece la compra y aclara que no requirió cobro. La presentación no se activa por volver de Stripe ni por parámetros de la URL: utiliza únicamente el estado que devuelve el servidor. Pendiente, rechazo, revisión, cancelación y reembolsos tienen mensajes distintos y no celebran un pago confirmado.

El resumen presenta importe con MXN una sola vez, número de pedido, estado y fecha de última actualización con formato legible. El plazo del intento se muestra solo mientras el pedido está pendiente de pago. Incluye **Ver mis pedidos** para cuentas con sesión y **Seguir comprando**. Las acciones de reanudar y cerrar se conservan para intentos pendientes que no están en revisión. Los errores mantienen el último estado conocido y explican que no se pudo actualizar.

`usePaymentStatus.js` consulta al entrar y al recuperar visibilidad o foco de la ventana, además del regreso desde la caché de navegación. Actualiza los datos sin recargar la página. Agrupa eventos consecutivos de foco/visibilidad, no consulta mientras la pestaña está oculta y no superpone solicitudes; si se regresa durante una operación, deja una consulta pendiente para después. Desregistra los eventos al salir e ignora respuestas tardías. No inicia ni repite pagos automáticamente.

La animación SVG dibuja círculo y marca una sola vez al entrar al estado confirmado; se desactiva con `prefers-reduced-motion`. Se reutilizan colores, fuentes y estados del sistema visual. Demostración: abrir un pedido, cambiar de pestaña/ventana y regresar; comprobar la fecha/estado actualizado. Con un pago verificado aparece el agradecimiento; un intento pendiente mantiene su aviso y acciones.

Verificación: diez pruebas de pagos aprobadas, incluida la presentación de estados; compilación Docker correcta. `scripts/check-payment-status-browser.mjs` prueba en Edge con APIs simuladas el cambio pendiente → pagado al recuperar visibilidad, deduplicación, ausencia de recarga, movimiento reducido, error con último estado conservado, consultas sin solaparse y limpieza al salir. Comprueba ausencia de desbordamiento horizontal en móvil claro/oscuro. No se hicieron cobros ni se modificaron pedidos reales. Se inspeccionaron capturas de escritorio oscuro y móvil claro; las pruebas de eventos simulados no equivalen a comprobar todos los comportamientos de cada navegador.

## Error genérico al abrir Stripe después de crear la sesión

El intento de prueba quedó con sesión `open`, pago `unpaid` y reserva activa, pero el endpoint devolvía HTTP 503. El diagnóstico HTTP mostró `ReferenceError`: `setCookie` se utilizaba para guardar `fitness_guest_order` después de abrir la sesión, pero no estaba importado en el módulo compilado. Se corrigió con una importación explícita desde `h3`. No fue un cobro rechazado ni requirió crear otra sesión.

El manejo HTTP ahora conserva los errores específicos del carrito, inventario y proveedor de envío en lugar de convertirlos todos en error genérico. Para fallos inesperados registra únicamente operación, tipo de error y códigos técnicos permitidos; no guarda mensajes crudos, consultas, claves ni datos personales. Con autorización expresa del propietario se diagnosticó y reanudó únicamente el intento sandbox existente; no se completó un pago ni se generó otro intento. La revisión inicial se limitó a consultas de solo lectura hasta recibir esa autorización.

Verificación: ocho pruebas de pagos aprobadas y compilación Docker correcta. El endpoint real, con el intento de prueba autorizado, pasó de HTTP 503 a HTTP 200 y devolvió una URL validada de `checkout.stripe.com`; emitió la cookie HttpOnly/Secure y conservó la misma referencia de sesión y cantidad de intentos. El pago siguió sin aplicarse al pedido. Falta que el propietario complete el Checkout de prueba para comprobar webhook y confirmación final.

## Webhook de Stripe en producción

Stripe se conecta directamente al endpoint público HTTPS `/api/payments/stripe/webhook`. Se registra en Workbench, modo activo, para la propia cuenta y con los tres eventos de Checkout/pago soportados. Esta integración utiliza eventos Snapshot y versión `2025-09-30.clover`. El secreto `whsec_…` de ese destino se configura en el servidor junto con la clave live, entorno `live` y URL pública de retorno. Los secretos de pruebas y CLI no se reutilizan.

Para observarlo, revisar los intentos de entrega del destino en Workbench y el estado del pedido en la plataforma; una redirección exitosa no prueba el cobro. La firma, consulta de sesión, validación de importe/entorno y deduplicación siguen ejecutándose en servidor. No se requiere una terminal con Stripe CLI ni túnel para producción. Pasos en `docs/stripe-payments.md`, basados en la [documentación oficial](https://docs.stripe.com/webhooks). No se modificó el entorno ni se habilitaron cobros reales al documentar este flujo.

## Conectar Stripe al paso de pago

Activación local posterior: el propietario configuró ambas claves. Se comprobó en privado el prefijo de prueba y el secreto de webhook, se habilitó `NUXT_STRIPE_ENABLED=true` y se iniciaron app y reconciliador en entorno `test`. El contenedor confirmó las variables sin mostrar sus valores; salud HTTP 200 y primera revisión del reconciliador con cero intentos. Mantener el listener de Stripe CLI abierto. Esta comprobación no verifica todavía un pago ni una entrega de webhook de Stripe.

El proyecto usa Checkout alojado: al pulsar **Ir a pagar con Stripe**, el servidor revalida importe, tarifa y existencias, registra el intento, reserva inventario y devuelve la URL de Stripe. Los datos de tarjeta se capturan allí; no en el formulario de la tienda. El webhook verifica firma y entorno, consulta la sesión y aplica el pago al pedido una sola vez. Volver a `/pago` no acredita por sí mismo un cobro. Los reintentos, expiraciones, cancelaciones y reembolsos utilizan los casos de uso ya implementados.

Se conectaron a Docker `NUXT_STRIPE_ENABLED`, `NUXT_STRIPE_ENVIRONMENT`, `NUXT_STRIPE_SECRET_KEY`, `NUXT_STRIPE_WEBHOOK_SECRET`, `NUXT_STRIPE_SITE_URL` y `NUXT_STRIPE_MINIMUM_CENTS`. La configuración completa se exige antes de ofrecer pago, sin divulgar secretos al navegador. La clave publicable no es necesaria para este Checkout alojado. El perfil opcional `payments` incorpora `payment-reconciler` para revisar intentos cada minuto sin solapar vueltas; usa el mismo entorno y conserva intentos inciertos para revisión.

Demostración pendiente: crear cuenta/sandbox, guardar la clave `sk_test_…` y secreto `whsec_…` en `.env.docker`, mantener Stripe CLI reenviando los eventos al webhook local y habilitar el pago. Los pasos y comandos están en `docs/stripe-payments.md`. El propietario indicó que aún no tiene cuenta; no se crearon cuentas ni se habilitaron cobros con claves ficticias. Las variables permanecen en `test` y pagos deshabilitados hasta completar esa configuración. [Documentación oficial de claves](https://docs.stripe.com/keys) y [webhooks locales](https://docs.stripe.com/cli/listen).

Verificación: seis pruebas específicas de cliente, firma y configuración Stripe aprobadas; suite completa correcta, incluidas 90 pruebas PostgreSQL, y compilación Docker de app y reconciliador correcta. En el entorno local se comprobó `enabled=false`, entorno `test`, ausencia de claves, inicio de pago HTTP 503 y rechazo del reconciliador sin configuración. No se contactó a Stripe ni se movió dinero; falta prueba contractual con una cuenta sandbox y validación de redirecciones reales.

## Validación de envío antes de confirmar

**Continuar a confirmar pedido** permanece deshabilitado hasta contar con una tarifa aceptada del carrito actual, con fecha válida, no futura, antigüedad máxima de diez minutos y sin vencimiento del proveedor. Cotizar sin pulsar **Aceptar esta tarifa** no lo habilita. Un texto asociado explica qué falta. Al vencer la tarifa, un temporizador actualiza el estado y vuelve a deshabilitarlo; cambiar la dirección o el carrito también invalida la selección. La función que avanza mantiene la comprobación defensiva y muestra error inline y en toast si recibe una selección inválida. Después se validan los campos del formulario.

La misma comprobación se repite al confirmar: si venció durante la revisión, se vuelve al envío antes de registrar el pedido. El servidor mantiene sus comprobaciones de tarifa aceptada, carrito, dirección, empaque, total y vigencia; la validación del navegador no las sustituye. Prueba pura: selección ausente, carrito distinto, fechas inválidas/futuras y límites de vigencia. La prueba de navegador comprueba intentos sin cotizar, cotización sin aceptación y cambio de dirección, además del recorrido correcto con APIs simuladas.

Verificación: prueba pura y recorrido en Edge con perfil aislado aprobados; compilación Docker correcta y aplicación actualizada. El recorrido comprueba explícitamente el atributo disabled sin cotizar, tras cotizar sin aceptar, al vencer una tarifa y al editar la dirección; también verifica su habilitación al aceptar una tarifa vigente. La prueba no realizó cotizaciones externas ni creó pedidos reales.

## Publicación de políticas con varios párrafos

El error **Contenido inválido** se debía a reutilizar `accountText`, pensado para campos de una sola línea: rechazaba los saltos de línea de los borradores y del editor. El contenido ahora utiliza `policyContent`, una validación propia del dominio que permite párrafos y tabulaciones, convierte CRLF/CR a LF y conserva los límites de texto obligatorio y 50,000 caracteres. Sigue rechazando otros caracteres de control. Título y motivo mantienen su validación de una línea. El texto se muestra mediante interpolación segura, sin interpretar HTML.

Demostración: **Administración → Políticas → Revisar y editar**, introducir varios párrafos, revisar y aprobar el contenido y pulsar **Publicar política**. La corrección no publica por sí sola los borradores ni altera su contenido guardado. Las pruebas comprueban los tres textos iniciales, límites, saltos de Windows, controles y persistencia/auditoría de una política sintética con varios párrafos en la base aislada.

Verificación: las dos pruebas específicas del contenido y la suite completa aprobaron, incluidas 90 pruebas PostgreSQL; compilación Docker correcta. Se actualizó el contenedor local. No se publicaron políticas reales durante las pruebas.

## Errores también mediante toast

Los errores visibles de cuenta, catálogo, carrito, checkout, pagos, administración, políticas y posventa se reflejan en un toast de error, conservando el mensaje original junto al formulario o la vista. `UiErrorNotifications` observa los mensajes semánticos `role="alert"` después de la hidratación, incluyendo respuestas renderizadas por SSR y errores de `UiField`. Para una nueva funcionalidad, declarar el error visible con ese rol; no usarlo para mensajes de éxito. No se intercepta cada fallo HTTP: las respuestas recuperadas por renovación de sesión o reintentos internos no generan avisos falsos.

Los errores llevan icono y borde críticos y rol accesible `alert`; las confirmaciones mantienen el indicador de éxito y rol `status`. Se pueden cerrar, duran ocho segundos y pausan al enfocar o pasar el cursor. Se muestran como máximo cuatro. Los mensajes iguales activos se deduplican, se excluye la propia región de toasts de la observación y se ignoran errores ocultos o de diálogos cerrados. El toast se coloca dentro del modal abierto, conservando su accesibilidad. La validación nativa de formularios muestra también un aviso en español del primer campo inválido de cada intento. Los errores inesperados de Vue/Nuxt muestran un mensaje genérico, sin exponer excepciones técnicas; las páginas de error conservan su diseño y navegación y añaden toasts.

Demostración: provocar un error de formulario o servidor, comprobar el mensaje inline y el toast, cerrarlo y corregir los datos. Repetir dentro de un modal. Abrir un enlace inexistente para comprobar la página 404. `scripts/check-error-toasts-browser.mjs` usa Chrome/Edge sin ventana con perfil temporal y DOM sintético para comprobar aparición, duplicados, actualización, cierre sin bucles, errores ocultos, modal, validación nativa y una página 404 real, sin crear datos de negocio. La comprobación automatiza interacción y presencia en el DOM; no equivale a una revisión visual de todas las vistas.

Verificación del cambio: compilación Docker aprobada y prueba de navegador ejecutada correctamente contra `http://localhost:3001` con Edge y perfil temporal. Se verificaron todos los casos anteriores sin escrituras de negocio. No se repitieron las pruebas de PostgreSQL porque no cambian operaciones del servidor ni el esquema. Para repetir: configurar `TEST_HTTP_URL` local y `TEST_BROWSER_PATH` con el ejecutable de Chrome/Edge y ejecutar `node scripts/check-error-toasts-browser.mjs`.

## Políticas base mediante migración

La migración `20261016030000_initial_policy_drafts` incorpora textos originales de privacidad, términos y devoluciones basados en el funcionamiento documentado del proyecto. Se registran como borradores (`publishedAt = NULL`), sin crear cuentas ficticias ni atribuir una aprobación inexistente. El contenido marca los datos que debe completar el propietario: identidad y domicilio del responsable/proveedor, contactos, procedimientos de privacidad, conservación, logística y devoluciones. La propuesta comercial del proyecto contempla treinta días para solicitar devoluciones y envío gratuito desde $1,499 MXN según la base configurada; no se inventaron plazos bancarios ni fechas de entrega.

`ContentPage.updatedById` admite nulo solo para contenido no publicado; la restricción `ContentPage_published_author` exige un responsable identificado cuando existe fecha de publicación. La publicación administrativa sigue exigiendo sesión ADMIN, aprobación, versión y auditoría. La migración conserva por slug todo contenido existente; el plugin de inicio crea únicamente las políticas ausentes, sin sobrescribir ediciones ni volver a publicar nada.

Demostración: **Administración → Políticas → Revisar y editar**. Leer el borrador y su vista previa, completar pendientes y aprobar/publicar cada política. Hasta publicar las tres, confirmar pedidos sigue bloqueado: contar con texto inicial no equivale a aprobarlo. Los textos fuente están en `server/features/policies/initial-policies.js` y los datos iniciales quedan fijados en la migración. Si se cambia el modelo base en el futuro, crear otra migración; no editar una ya aplicada.

Referencias para la revisión: [ley de datos personales, artículo 15](https://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo125102.html), que exige identificar al responsable y describir finalidades y medios para ejercer derechos, y [Monitoreo de Tiendas Virtuales de Profeco](https://burocomercial.profeco.gob.mx/tiendasvirtuales/), que contempla información de proveedor, precios, privacidad, entrega y devoluciones. Los borradores no certifican cumplimiento legal ni sustituyen completar la información real del proyecto.

Verificación: compilación Docker y suite correctas, incluidas 90 pruebas PostgreSQL. Se probó la migración en base aislada, reposición de faltantes, ejecución repetida, conservación exacta de ediciones y publicaciones, y rechazo en base de una publicación sin autor. Se aplicó al entorno Docker local y se comprobó la presencia de las tres políticas y salud HTTP 200. No se publicaron automáticamente; la revisión visual sigue pendiente.

## Bloqueo al confirmar por políticas no publicadas

La consulta de solo lectura al entorno local confirmó que no existen registros para `privacidad`, `terminos` y `devoluciones` en `ContentPage`. Confirmar el pedido exige las tres políticas publicadas y guarda su contenido/versión como evidencia de lo aceptado. Marcar la casilla del checkout no crea ni publica esas políticas. El rechazo ocurre dentro de la transacción, antes de registrar el pedido.

En **Administración → Políticas** aparecen las tres políticas, con estado, versión y fecha de publicación. **Agregar contenido** o **Revisar y editar** abre un modal con título, texto, vista previa segura, motivo y aprobación explícita. **Publicar política** solo se habilita tras aprobar el contenido; editar título o texto vuelve a desmarcar la aprobación. La confirmación es un toast; los errores permanecen dentro del modal, conservando lo escrito. Cerrar sin publicar descarta los cambios; no existe guardado de borradores persistentes. **Ver política publicada** abre la página pública.

`GET /api/admin/policies` exige administrador vigente y devuelve las tres entradas, incluyendo las todavía ausentes con versión 0 y texto vacío. La publicación reutiliza `POST /api/policies/:slug` con sesión ADMIN, origen propio, título, contenido, versión esperada y `approved: true`; conserva el bloqueo por política, rechazo de cambios concurrentes y auditoría de contenido/versión y motivo. No requiere migración. El propietario debe proporcionar o aprobar el contenido antes de publicarlo; no se insertaron textos legales inventados ni se desactivó la validación. Después de publicar las tres, volver a revisar y aceptar las políticas y confirmar el pedido con una cotización vigente.

Verificación: compilación Docker correcta, suite unitaria y 88 pruebas PostgreSQL aprobadas. La prueba de políticas cubre listado administrativo, rechazo a clientes, contenido faltante/vigente, aprobación, motivo, versión, publicaciones concurrentes y auditoría. Salud HTTP 200 y listado administrativo anónimo HTTP 401. No se publicaron políticas en la tienda durante la comprobación. Revisión visual de los modales pendiente.

## Compra en pasos: envío, confirmación y pago

En el carrito, **Continuar con la compra** abre `/checkout` sin exigir una tarifa previa; el cotizador ya no está dentro del carrito y su resumen muestra solo productos. El indicador accesible muestra tres pasos: **Cotizar envío**, **Confirmar pedido** y **Pago**. Navegar a esa página todavía no crea el pedido. El primer paso reúne dirección, correo, colonia y números, permite usar direcciones guardadas y exige cotizar y aceptar una tarifa antes de avanzar. El segundo muestra productos, cantidades, precios unitarios, dirección, servicio de envío, subtotal después de descuentos, envío y total. Permite volver a editar y requiere aceptar las políticas antes de confirmar.

**Confirmar pedido y continuar al pago** llama a `/api/checkout/prepare`, que revalida carrito, existencias, empaque, dirección, tarifa aceptada vigente (máximo diez minutos) y total, además de las tres políticas publicadas. Solo después de una respuesta correcta se avanza al paso Pago. Los errores conservan el formulario y la confirmación; los reintentos con los mismos datos conservan la clave de idempotencia y los datos modificados generan otra clave. No se permite saltar desde el indicador de pasos. El título de cada paso recibe foco para facilitar la navegación con teclado y lectores de pantalla.

Si las validaciones pasan, registra el pedido como `PENDING_PAYMENT`, conserva una copia de productos, precios, dirección, envío y políticas, y muestra su número. No cobra, no reserva stock, no vacía el carrito ni genera una guía. En el tercer paso se muestra **Ir a pagar con Stripe** únicamente cuando los pagos están habilitados; de lo contrario se indica que el pedido sigue pendiente y el pago aún no está disponible. No se habilitó Stripe como parte de este cambio. La confirmación de compra pagada depende de verificar el pago, no de llegar a ese paso.

Demostración: pulsar **Continuar con la compra** desde el carrito, completar los datos o elegir una dirección guardada, cotizar y aceptar una tarifa, y avanzar al resumen. Volver con **Editar datos** conserva campos y tarifa; modificar la dirección invalida esa tarifa y requiere cotizar de nuevo en el primer paso. Avanzar, aceptar las políticas y confirmar. Comprobar número, estado pendiente de pago y disponibilidad del pago. No se crearon pedidos ni se iniciaron cobros reales para implementar la interfaz.

Verificación del traslado del cotizador: compilación Docker correcta y `scripts/check-checkout-steps-browser.mjs` aprobado en Edge con perfil aislado y APIs simuladas. Comprueba carrito sin cotizador, acceso sin tarifa, dirección guardada, bloqueo hasta aceptar envío, confirmación, regreso con datos conservados, invalidación al cambiar dirección y paso de pago. No usa datos personales reales ni consulta proveedores o crea pedidos en la base. No cambia las reglas del servidor; la comprobación de interfaz no equivale a un cobro real ni a una revisión visual de todos los tamaños de pantalla.

## Fallo de tarifa con Afimex en pruebas

Después de registrar las cajas, el diagnóstico seleccionó CAJA-CHICA, 250 × 200 × 200 mm y 1300 g. La cotización con la paquetería configurada `afimex` devolvió HTTP 200, `meta: error`, código 1126: no se pudo obtener el precio. Este rechazo no confirma que la dirección sea inválida ni que las cajas sigan fallando. La integración ahora muestra un aviso específico con el código 1126 y permite reintentar. No se expone texto arbitrario de la respuesta.

Con autorización expresa del propietario, se comparó la misma solicitud en sandbox con DHL y Estafeta, sin generar guías, guardar cotizaciones ni cambiar la configuración. DHL devolvió cuatro tarifas válidas: 285.34, 272.09, 312.40 y 269.18 MXN. Estafeta devolvió dos: exprés 191.72 y terrestre 154.72 MXN. Ambos resultados pasaron la validación del cliente de la plataforma. Esto acota el fallo a la cotización con Afimex para esta solicitud/entorno; no demuestra una caída general ni permite asegurar su causa interna. Son tarifas de prueba observadas, no precios garantizados.

Después de la comparación, el propietario autorizó configurar Estafeta. Se actualizó únicamente `NUXT_ENVIA_CARRIER=estafeta` en el archivo privado `.env.docker`, conservando el entorno `test`, y se recreó la aplicación. El contenedor confirmó la nueva paquetería, presencia del token y salud HTTP 200. Volver a cotizar desde el primer paso de la compra para obtener y aceptar una tarifa vigente. Envia advierte que algunas paqueterías pueden faltar o comportarse distinto en el [ambiente de pruebas](https://help.envia.com/ambiente-pruebas).

## Cajas de referencia al inicializar

La migración `20261016020000_reference_shipping_packages` agrega tres cajas activas autorizadas como valores iniciales de referencia, no medidas físicas certificadas. Largo × ancho × alto, en milímetros:

| Código | Interior (mm) | Exterior (mm) | Caja vacía (g) | Máximo bruto (g) |
| --- | --- | --- | --- | --- |
| CAJA-CHICA | 240 × 190 × 190 | 250 × 200 × 200 | 150 | 5000 |
| CAJA-MEDIANA | 340 × 290 × 240 | 350 × 300 × 250 | 300 | 10000 |
| CAJA-GRANDE | 440 × 340 × 290 | 450 × 350 × 300 | 500 | 20000 |

El INSERT usa `ON CONFLICT (code) DO NOTHING`: conserva IDs, medidas, versiones y disponibilidad de cajas existentes. El plugin de inicio comprueba esos mismos códigos y crea únicamente los faltantes. No reactiva cajas desactivadas ni sobrescribe ajustes. Si se cambia el código de una caja base, se considera otra caja y el código base se vuelve a crear al reiniciar. Las demás cajas, incluida la caja registrada previamente, permanecen intactas.

Verificación: migración aplicada al entorno local, compilación Docker correcta y suite aprobada con 88 pruebas PostgreSQL. La prueba específica comprueba valores iniciales desde la migración, reejecución del INSERT, inicio repetido, conservación de una caja editada/desactivada y reposición de una faltante. Revisión visual y nueva cotización con estas cajas pendientes.

En **Administración → Inventario → Cajas de envío** se pueden ver y editar. Verificar medidas y resistencia con las cajas físicas antes de utilizarlas para envíos reales. Si una caja anterior de 90 cm sigue activa, puede seguir siendo elegida si las otras no admiten el pedido; corregirla o desactivarla explícitamente. El algoritmo elige la caja apta de menor volumen exterior, no por el nombre chica/mediana/grande.

## Rechazo de Envia por límite de peso

El diagnóstico de cotización devolvió HTTP 200 con `meta: error`, código 1105 y rechazo de paquetes de más de 70 kg. HTTP 200 no garantiza una tarifa: también se valida el cuerpo de la respuesta. La caja local tenía medidas exteriores de 900 × 900 × 900 mm (90 cm por lado), mientras el peso físico del producto más la caja era 1160 g. Por ello, el peso volumétrico es la causa probable; el proveedor no especificó en esa respuesta cómo calculó el peso.

Revisar **Administración → Inventario → Cajas de envío → Editar caja**, capturar medidas reales en milímetros y peso vacío en gramos, y volver a cotizar. Por ejemplo, 30 cm se capturan como 300 mm; esto explica la conversión y no prescribe medidas comerciales. No se modificaron los datos registrados automáticamente. La integración traduce este rechazo conocido a un aviso sobre peso físico, volumétrico y unidades; no expone mensajes arbitrarios del proveedor ni credenciales.

## Error de caja apta al cotizar

La consulta de solo lectura al entorno local confirmó que `PackageType` no tiene registros. Por eso `choosePackage`, en `shared/features/shipping/pack-order.js`, no encuentra una caja para el pedido y detiene la cotización antes de consultar Envia. No es un rechazo del token ni de la dirección del cliente.

Para continuar se requieren cajas activas con código, dimensiones interiores y exteriores en milímetros, peso de la caja vacía en gramos y, opcionalmente, peso bruto máximo. Las variantes requieren peso y dimensiones válidos. El algoritmo comprueba que todos los artículos quepan en una sola caja, permitiendo rotaciones, y añade el peso de la caja al de los productos. No se insertaron medidas inventadas.

En **Administración → Inventario → Cajas de envío**, pulsar **Agregar caja** para abrir el modal. Registrar código único, medidas y pesos reales y motivo. La lista muestra toda la configuración; **Editar caja** permite corregirla o cambiar su disponibilidad, incluyendo reactivar una caja. Las confirmaciones se muestran como toast y los errores permanecen dentro del modal. Las medidas deben ser enteros positivos, las exteriores no pueden ser menores que las interiores, el peso vacío permite cero y el máximo opcional debe superar ese peso. El código se normaliza a mayúsculas para evitar duplicados por capitalización.

El módulo `server/features/shipping/manage-packages.js` exige administrador vigente dentro de una transacción, bloquea la caja al editar, comprueba su versión e incrementa esa versión. Cada alta o cambio registra motivo y datos anteriores/nuevos en auditoría. No se eliminan cajas ni se cambian los snapshots de pedidos existentes. La cotización vuelve a comprobar el empaque y su versión antes de la compra. No requiere migración: utiliza `PackageType`, ya presente en el esquema. Demostración: registrar una caja, editarla, desactivarla/reactivarla y volver a pulsar **Cotizar servicios** en el carrito. Registrar una caja no garantiza que cualquier pedido quepa; se siguen comprobando tamaño y peso.

Verificación: compilación Docker correcta y suite aprobada, incluidas 87 pruebas PostgreSQL. La prueba de cajas comprueba permisos, medidas inválidas, códigos duplicados, ediciones simultáneas, auditoría, activación y uso de la caja en el cálculo de empaque. No se cargaron cajas ficticias en la base de la aplicación. Revisión visual y cotización con Envia pendientes.

## Mensaje «Cotización no configurada»

Para obtener la configuración, crear primero una cuenta de [sandbox](https://accounts-sandbox.envia.com/signup), entrar al [panel de desarrolladores de pruebas](https://shipping-test.envia.com/settings/developers), abrir Desarrolladores → Acceso de API / API Keys y generar el token con Agregar. El token solo funciona en el entorno donde se generó ([autenticación oficial](https://docs.envia.com/docs/authentication)). Para la paquetería, consultar `GET https://queries.test.envia.com/carrier?country_code=MX` con `Authorization: Bearer <token>` y usar el valor exacto de `name` de una paquetería disponible como `NUXT_ENVIA_CARRIER`, no su descripción ([referencia oficial](https://docs.envia.com/reference/carriers-by-country)). Mantener `NUXT_ENVIA_ENVIRONMENT=test` para ese token. Configurar los valores en `.env.docker` y recrear app; no se necesita subirlos a Git ni compartirlos en el chat. La disponibilidad real depende del entorno, la cuenta y la ruta.

Este mensaje indica que la integración de Envia.com no tiene token, paquetería o entorno válido; se produce antes de consultar al proveedor y no significa que la dirección capturada sea incorrecta. `createEnviaRates` requiere `NUXT_ENVIA_TOKEN`, `NUXT_ENVIA_CARRIER` y `NUXT_ENVIA_ENVIRONMENT` (`test` o `production`). No se inventan tarifas ni se sustituyen por un costo ficticio.

En Docker local, configurar esas variables en el archivo privado `.env.docker` y ejecutar `docker compose --env-file .env.docker -f compose.docker.yaml up -d --force-recreate app`. Compose ya las pasa al servicio app; el entorno predeterminado es `test`. Se necesita un token válido para ese entorno y el código de paquetería correspondiente. No guardar credenciales en Git ni enviarlas en evidencias. Completar el almacén y seleccionar una dirección son requisitos separados de la conexión al proveedor.

Verificación del entorno actual: después de configurar el archivo privado y recrear app, se confirmó que el contenedor recibió token y paquetería, que utiliza el entorno `test` y que la aplicación responde HTTP 200. Se verificó únicamente su presencia, sin mostrar valores sensibles. Sigue pendiente comprobar una cotización con el proveedor desde el carrito.

## Usar direcciones de la cuenta para cotizar

El selector de direcciones guardadas ocupa toda la fila del formulario. **Cotizar servicios** aparece en una fila propia, debajo de los campos y alineado a la izquierda. Ajuste de distribución verificado con compilación; revisión visual pendiente.

En **Carrito → Continuar con la compra → Cotizar envío**, una cuenta con sesión activa puede elegir **Usar una dirección de mi cuenta**. Se carga desde `/api/account/profile`, que devuelve únicamente las direcciones del usuario autenticado. Se propone la predeterminada (o la primera) cuando el formulario está vacío; no sobrescribe datos ya escritos ni una tarifa recuperada. Los invitados conservan la captura manual. Sin direcciones, se muestra un enlace para agregarlas en Mi cuenta; ante fallos de carga se permite reintentar.

La selección completa destinatario, teléfono, calle/números, colonia, ciudad, estado y código postal. `saved-destination.js` convierte nombres reconocidos del estado o sus códigos al catálogo de Envia.com; un estado desconocido queda vacío para seleccionarlo explícitamente. Escribir otra dirección limpia los campos; editar lo completado solo modifica esta cotización, sin cambiar la dirección de la cuenta. Cualquier cambio invalida las tarifas anteriores. Al cerrar sesión o cambiar de cuenta se descarta la selección anterior y se ignoran respuestas de perfil obsoletas.

Demostración: registrar una dirección y marcarla como predeterminada en `/cuenta`, abrir el primer paso de la compra, comprobar sus datos, seleccionar otra dirección y volver a cotizar. La integración utiliza las mismas cookies y renovación automática de cuenta. Las pruebas de `saved-destination.test.mjs` verifican composición de dirección, conservación de datos, estados por nombre/código y estado desconocido. La compilación y las pruebas de datos no equivalen a una revisión visual ni a una cotización real con Envia.com.

Verificación del cambio: build Docker y formulario Vue correctos; 11 pruebas pertinentes de direcciones, estados y envío aprobadas. Consulta HTTP autenticada al perfil correcta; la cuenta administrativa utilizada para esa comprobación no tenía direcciones, por lo que la conversión de direcciones guardadas se verificó con datos sintéticos. Revisión interactiva pendiente.

## Selector de estado al cotizar envío

En **Carrito → Continuar con la compra → Cotizar envío**, el campo **Estado** utiliza el mismo `UiField` con opciones y el mismo catálogo `mexicanStates` que el formulario del almacén. El usuario selecciona el nombre de una de las 32 entidades; se envía su código de dos letras de Envia.com, sin tener que escribirlo. Por ejemplo, San Luis Potosí envía `SL` y Ciudad de México envía `CX`. Mantiene la selección de una cotización existente, campo obligatorio y bloqueo mientras se consulta; cambiar el estado invalida la tarifa seleccionada y obliga a recotizar. No se modificaron los datos de direcciones existentes ni se hicieron consultas reales al proveedor para esta comprobación.

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

Las operaciones de administración, cuenta y apariencia, carrito/cupones, reseñas, avisos de reposición, solicitudes posventa y confirmación al iniciar pago muestran sus mensajes mediante un toast compartido. `app/composables/useToasts.js` mantiene la cola durante la navegación interna; `UiToasts.vue` la presenta en la página o dentro del diálogo abierto para que siga visible y accesible sobre un modal. `UiToast.vue` permite cerrar cada aviso y lo retira tras ocho segundos, pausando el tiempo al pasar el cursor o enfocar sus controles. Se muestran hasta cuatro avisos simultáneos; cada confirmación se anuncia con rol `status` y cada error con rol `alert`.

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

## CI/CD hacia EC2

`.github/workflows/ci-cd.yml` ejecuta pruebas en pull requests y pushes a `main`. Con `EC2_DEPLOY_ENABLED=true`, publica imágenes de aplicación/herramientas en GHCR por commit, despliega referencias por digest mediante SSH al environment `production`, respalda PostgreSQL antes de migrar, comprueba salud y conserva los volúmenes. Los secretos de la aplicación permanecen en el servidor. La instancia todavía no existe; la ejecución real de Actions y EC2 queda pendiente de configurarla y subir los cambios. La guía [GitHub Actions y EC2](github-actions-ec2.md) detalla preparación, los cuatro secretos SSH, credenciales de lectura GHCR y activación.

`deploy/compose.ec2.yaml` separa este entorno del local, reinicia servicios y mantiene PostgreSQL privado. Nginx sirve HTTPS; `prepare-server.sh` genera configuración y certificado autofirmado para demostrar sin dominio, sin sobrescribir secretos existentes. Las cookies Secure y la comprobación de origen se conservan. El certificado necesita confianza en los equipos de prueba y no habilita por sí solo webhooks públicos de Stripe. Las actualizaciones pueden interrumpir brevemente el servicio y no incluyen rollback automático de esquema.

Verificación: workflow validado con actionlint y shellcheck; Bash/Compose correctos; pruebas simuladas de respaldo, fallos de migración/aplicación/salud, reconciliador e inicialización repetida aprobadas. Se levantó además un stack Docker efímero con el Compose de EC2, migraciones y proxy HTTPS: salud, certificado, registro, login, sesión Secure y rechazo de otro origen correctos. Se usaron puertos, usuarios y volúmenes separados de la tienda. El script `check-ec2-compose.sh` incorpora esa comprobación a CI. Esta evidencia local no equivale a un despliegue verificado en EC2.

## Diseño y selección en la página de producto

### Catálogo inicial para demostración

El historial de ejemplo se incorpora mediante `20261016060000_demo_customers_orders_reviews`: seis clientes sin contraseña utilizable, doce pedidos en estados variados y ocho reseñas de cuatro pedidos entregados. Los números, autores y opiniones llevan DEMO; no representan compradores o testimonios reales. Los pedidos avanzados tienen bonificación del 100%, total cero y dinero No requerido, sin registros ficticios de pagos Stripe. Los lotes históricos registran recepción/reserva/consumo y terminan en cero, conservando las 526 piezas iniciales disponibles. No se generan envíos, correos ni guías. Se difiere el historial hasta configurar almacén cuando no existe. Detalles y demostración en [Clientes, pedidos y reseñas de demostración](datos-demostracion-pedidos.md).

La migración `20261016040000_demo_catalog` instala 28 artículos publicados, cuatro en cada una de las siete categorías base. Incluye textos, marca de demostración, SKU, precio, medidas, nutrición cuando aplica, recomendaciones e ilustraciones WebP locales. Todos llevan DEMO en el nombre y describen sus datos como ilustrativos. Se preservan los productos existentes. La migración posterior `20261016050000_demo_catalog_stock` agrega, por solicitud del propietario, existencias ficticias entre 2 y 60 piezas mediante lotes DEMO y entradas del ledger. No agrega certificados. Las reseñas de ejemplo se incorporan en la migración del historial descrita arriba. Se documentan cantidades y asociación de imágenes en [Catálogo inicial de demostración](catalogo-demostracion.md).

Para demostrarlo, abre `/catalogo?q=DEMO`, selecciona una categoría y consulta sus cuatro fichas. Las imágenes están versionadas en `public/images/catalog/demo/` y relacionadas mediante `MediaAsset` y `ProductMedia`, por lo que se incluyen en cada build. Una instalación nueva carga los registros al aplicar migraciones; si aún no existe almacén, el stock se inicializa al configurarlo. Reiniciar conserva los cambios del administrador, no repone existencias consumidas y no republica ni reinserta productos retirados.

Verificación: 86 pruebas unitarias y 100 PostgreSQL aprobadas, incluidas inicialización diferida, cantidades del ledger, idempotencia del stock y coherencia de clientes, pedidos y reseñas. Cada ampliación utiliza una migración nueva y conserva las previamente aplicadas. La prueba de navegador `scripts/check-demo-catalog-browser.mjs` comprueba cuatro artículos por categoría, disponibilidad inicial, 28 imágenes, detalle nutrimental, reseñas DEMO y ancho móvil en ambos temas. La prueba de navegador solo lee datos; no crea compras ni modifica carritos.

**Cobertura del panel administrativo:** en Administración → Productos → Crear producto o Gestionar se registran ingredientes, modo de uso, alérgenos y marca, además de los campos comerciales existentes. Registrar marca abre un formulario con nombre, identificador y motivo; no guarda automáticamente el formulario del producto. Cada presentación permite capturar tamaño y unidad de porción y una tabla de nutrimentos con nombre, cantidad declarada y unidad. Se transcriben los valores documentados en la etiqueta, sin inventar valores por 100 gramos. El número de porciones por envase sigue siendo independiente del tamaño de cada porción.

En Gestionar → Presentaciones adicionales → Agregar presentación se registra otro SKU, sabor, contenido, precio, medidas y nutrición para el mismo producto. Se crea sin inventario; sus existencias se registran como lotes. Conviene guardar primero los cambios pendientes del producto. Imágenes → Agregar imagen permite asignarla a todas las presentaciones o a una específica; una frontal o nutrimental reemplaza el papel de la anterior solamente dentro de esa asignación. Las imágenes anteriores se conservan como galería y sigue vigente el máximo de veinte por producto.

Recomendaciones permite buscar por nombre o SKU y seleccionar hasta ocho productos por grupo: También te puede servir en la ficha y Súmalo a tu pedido en el carrito. Subir/Bajar determina el orden. Se pueden preparar relaciones con borradores, pero la tienda solo muestra recomendaciones publicadas y activas. No se permite recomendar el producto a sí mismo ni repetirlo dentro del grupo.

En Administración → Inventario, el alta del lote incluye origen, fecha de importación y aduana o registro de entrada. Cada lote tiene Editar trazabilidad y certificado para completar o corregir esos datos y cargar, reemplazar o retirar un PDF de hasta 20 MB. Esta operación no cambia código de lote, caducidad ni existencias. Los archivos quedan en la subcarpeta `certificates` del directorio de cargas configurado (`NUXT_CATALOG_UPLOAD_DIRECTORY`), reutilizando el volumen Docker de imágenes. Conservar ese volumen es necesario para conservar imágenes y certificados al recrear la aplicación. Reemplazar o retirar mantiene el archivo anterior como respaldo de auditoría; su consulta pública deja de estar vinculada al lote.

Los casos de uso validan rol administrador en cada operación, motivo y versiones para evitar sobrescribir cambios simultáneos. Las escrituras relacionadas son transaccionales y quedan auditadas. Los PDF se comprueban por tipo, firma, tamaño y checksum al leerlos; los nombres de almacenamiento los genera el servidor. Un administrador puede consultar el certificado de un borrador; para los visitantes se mantiene la restricción de publicación del catálogo. La comprobación de formato no certifica autenticidad del contenido ni sustituye la revisión del documento por el responsable.

Se reutiliza el esquema existente, sin migraciones nuevas. La comparación por porción y disponibilidad se calculan; las reseñas las escriben los compradores habilitados. Los textos y datos opcionales no se rellenan con información comercial ficticia. La gestión de marcas cubre alta y asignación; no incluye edición o desactivación de marcas. La búsqueda muestra veinte coincidencias de productos y pide precisar el término cuando hay más.

Verificación: compilación Docker correcta y suite PostgreSQL aislada con 94 pruebas aprobadas, incluidas persistencia, permisos, rollback, duplicados, versiones, PDF e imágenes por presentación. `scripts/check-admin-product-details-browser.mjs` comprueba en Edge registro/asignación de marca, textos, tabla nutrimental, recomendaciones, nueva presentación, trazabilidad, carga de PDF y ancho móvil con sesión y escrituras simuladas. Se inspeccionó una captura móvil del formulario. No se registraron datos comerciales ni archivos ficticios en la base real para realizar estas pruebas.

La ficha reproduce la composición del diseño de referencia en ambos temas, con la modificación solicitada de colocar las miniaturas en una fila debajo de la imagen principal en todos los tamaños. Conserva flechas de navegación, panel de compra a la derecha, trazabilidad a todo lo ancho, acordeones, información nutrimental, comparación por porción, reseñas con resumen lateral y recomendaciones al final. En móvil la galería y la compra se apilan, las miniaturas se desplazan horizontalmente y permanece el resumen inferior de compra. No incluye fecha estimada de entrega ni el campo de código postal del prototipo.

Para demostrarlo, abre un producto y cambia su presentación o sabor. Los botones de presentación conservan la variante en la URL; `selectedVariant`, `variantPricing`, `productQuantity` y `comparePresentations` siguen definiendo selección, precios, límites y comparación. La cantidad vuelve a uno al cambiar de variante, los botones menos/más respetan el stock, y tanto Agregar al carrito como Comprar ahora conservan los flujos existentes. Las imágenes específicas sustituyen las genéricas del mismo tipo; al cambiar de variante la galería vuelve a su frente. Las flechas, miniaturas y navegación con teclado permiten recorrer imágenes.

`ProductInformation.vue`, `ProductNutrition.vue` y `ProductComparison.vue` presentan los acordeones y tablas. Descripción abre inicialmente y las demás secciones se pueden desplegar. Se muestran los nutrientes documentados en el formato actual: no se calculan valores por 100 gramos ni se inventan filas. Los campos de uso o ingredientes ausentes se identifican como pendientes; los certificados solo enlazan cuando hay un archivo disponible. Las recomendaciones siguen dependiendo de las relaciones registradas, sin productos de ejemplo como respaldo.

La compilación Docker, 14 pruebas de selección/imágenes/precios y la prueba `scripts/check-product-layout-browser.mjs` verifican el cambio de sabor y presentación, imagen, precio, porciones, lote, stock, cantidad inválida y máxima, agotados, ambas acciones de compra, tablas y anchos móviles. La prueba de navegador simula los datos de producto, reseñas y carrito para evitar compras reales. Se revisan capturas completas en claro y oscuro y una captura móvil; los datos sintéticos no se guardan en el sistema.

## Distribución del catálogo y sus filtros

El catálogo presenta título y total de productos, una barra con el intervalo de resultados a la izquierda y ordenamiento a la derecha, y debajo un panel lateral de filtros con desplazamiento independiente. Las etiquetas de filtros activos aparecen sobre los resultados y permiten quitar cada condición o limpiar los filtros. En escritorio se muestran cuatro tarjetas por fila y la paginación queda centrada. En móvil el panel se puede plegar; al regresar al ancho de escritorio se abre nuevamente.

Se conservan únicamente los filtros existentes: categorías, objetivos, disciplinas, disponibilidad, costo por porción, presentaciones y rango de precio. Los grupos sin opciones siguen ocultos. No se agregan marcas, garantías, plazos de entrega ni otras condiciones tomadas de la referencia. `useCatalogFilters.js` reúne el estado y las acciones que antes estaban en el componente lateral, para compartirlos con las etiquetas; mantiene los parámetros de URL, reinicio de página al filtrar y validaciones del rango.

Para demostrarlo, abre Catálogo, selecciona una categoría, quita su etiqueta, aplica precios y cambia el orden. Al aplicar o quitar filtros se conserva la búsqueda y el orden actuales. `scripts/check-catalog-layout-browser.mjs` verifica estos flujos, paginación, precios inválidos, temas y anchos móvil/escritorio con respuestas simuladas. Pasaron 55 pruebas de catálogo, la compilación Docker y la prueba de navegador; se revisaron capturas de ambos temas y móvil.

## Diseño del inicio en claro y oscuro

La página principal reproduce la composición de las referencias del propietario: franja de envío gratis desde $1,499, encabezado compacto, portada con colores invertidos, bloque Price Match con borde superior amarillo, cuadrícula de cuatro productos por fila en escritorio, beneficios, categorías con iconos y pie de cuatro columnas. Los tokens existentes determinan la variante clara y oscura. El orden de los enlaces administrativos y la configuración del tema dentro de la cuenta se conservan.

El inicio muestra la selección real configurada por el administrador; no calcula un ranking de ventas ni inventa ocho productos para llenar la cuadrícula. Los conteos de categorías provienen de la base de datos. El skeleton ilustrativo del prototipo no es contenido permanente: los skeletons aparecen durante la carga. Se mantienen las siete categorías actuales y los datos reales de contacto configurados; no se copian contactos, ubicación ni medios de pago ficticios del ejemplo.

`HomePriceGuarantee.vue` presenta el texto Price Match proporcionado en la referencia y abre un modal informativo con enlace a Contacto. No implementa reembolsos automáticos ni un sistema de reclamaciones. `HomeBenefits.vue` describe trazabilidad, desglose de precio y cotización de envío; no promete entrega local en 24–48 horas sin una cotización que la respalde. Las tarjetas agotadas usan la acción compacta Avisarme cuando llegue y conservan el formulario de registro de interés.

Para demostrarlo, visita Inicio y cambia el tema desde Mi cuenta. Prueba Leer condiciones, su cierre con Escape y los enlaces de categorías. `scripts/check-index-design-browser.mjs` verifica ambos temas, cuatro columnas con ocho productos simulados, el modal, devolución del foco, registro de interés desplegable, navegación y ausencia de desbordamiento a 390, 768 y 1280 píxeles. La compilación Docker y la revisión de capturas completas en ambos temas complementan estas comprobaciones; los productos simulados solo existen dentro de la prueba de navegador.

## Diseño de tarjetas de producto

`ProductCard.vue`, compartido por inicio y catálogo, muestra imagen sobre fondo blanco, título en mayúsculas, SKU/lote/caducidad, indicador de disponibilidad, precio con moneda secundaria, costo por porción y un botón de ancho completo para agregar una pieza de la presentación mostrada. Imagen y tarjeta enlazan al detalle con esa variante seleccionada; el botón de compra es una acción independiente. Se conserva la vista de información nutrimental y el registro de interés cuando no hay existencias.

Las fotos no llevan textos ni botones superpuestos. `CardPackshot.vue` mantiene ambas imágenes montadas y aplica una transición de opacidad y desenfoque de 280 ms al pasar el cursor, mostrando la información nutrimental cuando está disponible y volviendo al frente al salir. También ofrece esa vista al enfocar el enlace con teclado. Respeta la preferencia de movimiento reducido y conserva el clic hacia el detalle del producto; en pantallas táctiles el toque abre el detalle, donde se puede consultar la galería.

No se promete envío el mismo día a partir del stock. El lote es orientativo y su asignación se confirma al reservar. Porciones y tamaño de porción aparecen únicamente si hay datos para mostrarlos. El diseño usa los tokens claro/oscuro y se adapta al ancho disponible.

Para verlo, abre el inicio o el catálogo. Se verificó la compilación Docker y se revisaron capturas en escritorio y móvil, en temas claro y oscuro. La prueba de interacción usó datos y agregado al carrito simulados para comprobar precio, porciones, lote, caducidad, producto agotado, enlaces y agregado independiente, sin modificar el carrito real.

## Portada de la página principal

El primer bloque de `StoreHome.vue` presenta el título, descripción y botón Ver catálogo proporcionados por el propietario. Utiliza las fuentes y tokens de tema del proyecto, con una composición adaptable a escritorio y móvil. El botón dirige a `/catalogo` y el bloque aparece antes de Nuestra selección. El texto comercial es contenido editorial proporcionado por el propietario; no representa una validación automática de certificados, procedencia o condiciones fiscales de cada producto.

## Nuestra selección de productos en el inicio

La selección se define en el campo opcional `Product.featuredPosition` de la base de datos. Un valor numérico marca al producto como destacado y determina su orden ascendente; `null` lo excluye. El caso `home()` de `server/features/catalog/catalog-repository.js` devuelve como máximo ocho productos destacados, publicados y activos, con alguna variante activa y marca activa si tienen marca. No se eligen automáticamente por ventas, reseñas o fecha de creación.

`StoreHome.vue` presenta los resultados de `/api/catalog/home` en Nuestra selección. Si no hay productos que cumplan los requisitos, muestra Estamos preparando nuestra selección de productos. Publicar un producto por sí solo no lo incluye en la selección.

Para configurarla, abre Administración → Productos → Gestionar → Nuestra selección del inicio. Asigna una prioridad entera entre 1 y 1000, escribe el motivo y pulsa Guardar cambios. Una prioridad menor aparece antes; con prioridades iguales se usa el identificador como desempate. Deja la prioridad vacía y guarda para quitarlo de la selección sin retirarlo del catálogo. Los borradores pueden prepararse con prioridad, pero solo aparecerán cuando se publiquen. Si hay más de ocho candidatos visibles, se muestran los primeros ocho. La tarjeta administrativa identifica la prioridad guardada y avisa si falta activar o publicar.

Se reutiliza el campo existente, sin migración adicional. `featured-selection.js` valida el dato; `manage-store.js` aplica la autorización, bloqueo y control de versión del producto, y registra el valor anterior y nuevo en auditoría. Las pruebas `tests/database/featured-selection.test.mjs` y `store-home.test.mjs` verifican permisos, validación, orden, publicación, retiro, versión y auditoría. La configuración se aplica a la siguiente consulta del inicio; las páginas ya abiertas requieren actualizarse.

## Skeletons y carga entre páginas

El layout compartido utiliza `useLoadingIndicator` de Nuxt para detectar la navegación pendiente. Si tarda más de 200 ms muestra una barra superior y `UiPageLoading.vue`, conservando el encabezado y el pie. El contenido anterior queda oculto e inerte mientras carga y vuelve a estar disponible al terminar; no se pierden componentes por alternar la pantalla de carga. La barra indica actividad estimada, no porcentaje real de descarga.

`UiLoading.vue` ofrece skeletons de tarjetas, listas, formulario y detalle de producto. Catálogo conserva las tarjetas; cuenta usa formulario; carrito, pedidos, inventario, cajas, reseñas, puntos y políticas administrativas usan listas; el detalle de producto representa imagen e información. Son placeholders visuales sin datos ficticios, con mensajes accesibles y animación solo si el usuario permite movimiento. También aparecen durante nuevas consultas de datos dentro de una página.

Para demostrarlo, activa una conexión lenta en las herramientas del navegador y navega entre páginas o cambia una búsqueda del catálogo. `scripts/check-loading-browser.mjs` retrasa consultas de lectura y simula un error para verificar inicio y fin de la navegación, el contenido inerte, los skeletons y la recuperación con Reintentar. La compilación Docker y esta prueba de interacción pasaron; se revisó una captura de la pantalla de carga. Esto cubre la navegación dentro de la aplicación; antes de recibir el HTML inicial, la indicación de conexión depende del navegador.

## Acciones de edición de productos

En Administración → Productos → Gestionar, las acciones se organizan en tres filas: Cerrar edición, Descartar cambios y Guardar cambios; después Publicar y Retirar del catálogo con un indicador destacado de visibilidad; finalmente Activar o Desactivar según el estado actual. Los botones se ajustan al ancho disponible. Publicar guarda el formulario y exige sus validaciones; retirar pide un motivo en un modal y no guarda cambios pendientes. Activar conserva los datos y devuelve el producto a borrador. El cierre y descarte siguen disponibles cuando el producto está desactivado, mientras que guardar y publicar permanecen bloqueados.

## Recuperar una reseña para editar

La sección incluye un resumen del promedio con estrellas, total de reseñas verificadas y barras para las calificaciones de cinco a una estrella. Cada porcentaje corresponde al número de reseñas visibles de esa calificación dividido entre el total, redondeado al entero más cercano; por redondeo, los porcentajes no necesariamente suman exactamente 100. No se inventan calificaciones cuando el producto no tiene reseñas.

El formulario utiliza `ReviewRatingPicker.vue`, con cinco opciones de radio representadas por estrellas que se llenan hasta la calificación seleccionada. Se puede elegir con clic o con las flechas del teclado y se sigue enviando un número de 1 a 5 al servidor. `ReviewStars.vue` presenta el promedio y las calificaciones individuales con nombres accesibles. Para demostrarlo, abre el formulario, pulsa la tercera estrella y observa tres estrellas llenas y el texto 3 de 5; también puedes cambiar la selección con las flechas. La prueba `scripts/check-review-stars-browser.mjs` utiliza respuestas simuladas para comprobar la distribución, selección y envío sin publicar reseñas reales.

En la página de un producto, abre Publicar o editar mi reseña. Ir a mi cuenta permite iniciar sesión y Recuperar mi reseña para editar consulta `/api/reviews/products/:id/mine` para llenar la calificación, título y texto con la reseña existente. Recuperarla no guarda cambios: hay que pulsar Guardar reseña. Para una primera reseña se completa directamente el formulario; publicar requiere una compra entregada del producto. Los botones tienen separación y se ajustan al ancho disponible. La recuperación muestra un estado de carga y evita solicitudes simultáneas de consulta y guardado.

## Acceso directo a administración

El encabezado de la plataforma muestra un enlace directo a `/admin` junto a Mi cuenta cuando la sesión corresponde al rol ADMIN. `SiteHeader.vue` comparte la consulta `account-session` con la cuenta, de modo que el enlace se actualiza al iniciar o cerrar sesión. La visibilidad del enlace complementa la autorización del servidor; los endpoints administrativos siguen verificando el rol.

Para verlo, inicia sesión con una cuenta administradora y utiliza Panel de administrador en el encabezado. Las cuentas de cliente y los visitantes no muestran ese enlace.

El orden de navegación es Catálogo, Carrito, Panel de administrador y Mi cuenta. Al final aparece un icono con nombre accesible Cerrar sesión para usuarios autenticados. Invoca el endpoint de cierre de sesión, actualiza los datos compartidos y lleva a Mi cuenta; muestra la confirmación o el error mediante un toast.

## Paginación de cajas de envío

La vista de Inventario mantiene los lotes visibles y agrupa Información del almacén y Cajas de envío en dos acordeones inicialmente cerrados. Se pueden abrir independientemente mediante clic o con Enter/Espacio al enfocar su encabezado. Se utilizan los elementos nativos `details` y `summary` en `InventoryAdministration.vue`; los formularios continúan en modales y las cajas conservan su paginación.

En Administración → Inventario → Cajas de envío se muestran hasta cinco cajas por página, ordenadas por código. Los botones Anterior y Siguiente permiten recorrerlas y el indicador muestra el total de cajas y la página actual. Agregar y editar continúan disponibles mediante un modal.

El servidor aplica el límite mediante `skip` y `take` en `server/features/shipping/manage-packages.js`; no descarga todas las cajas al navegador. Valida el número de página y exige el rol administrador. Si la página solicitada supera las disponibles, devuelve la última. La selección de cajas para cotizar sigue considerando todas las cajas activas, independientemente de esta paginación administrativa.

Para demostrarlo, registra más de cinco cajas y utiliza Siguiente en esa sección. Las pruebas de base de datos en `tests/database/package-administration.test.mjs` verifican el tamaño de página, el orden, los totales, las entradas inválidas y que no se repitan ni omitan registros al recorrer una lista sin cambios concurrentes. El listado puede cambiar de posición si se modifica el código de una caja entre consultas.

## Alcance pendiente de cuentas que conviene reconocer

- Verificación de propiedad del correo y recuperación de contraseña por correo.
- Revisión visual de la renovación automática en navegador.
- Inicio de sesión con proveedores externos y doble factor.
- Validación de formato telefónico, verificación por SMS y comprobación física de direcciones.
- Política de contraseña más allá de los límites actuales de longitud y confirmación.

Estos pendientes no deben presentarse como implementados. La autenticación actual sí incluye contraseña con hash, JWT firmado, sesión persistida, renovación rotativa, revocación y autorización por rol.
