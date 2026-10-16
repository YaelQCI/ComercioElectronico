BEGIN;

-- Borradores del proyecto sin atribuir aprobaci?n a un usuario inexistente.
ALTER TABLE "ContentPage" ALTER COLUMN "updatedById" DROP NOT NULL;
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_published_author" CHECK ("publishedAt" IS NULL OR "updatedById" IS NOT NULL);

-- No modifica textos, versiones ni publicaci?n existentes.
INSERT INTO "ContentPage" ("id", "slug", "title", "content", "version", "publishedAt", "updatedById", "createdAt", "updatedAt")
VALUES
(gen_random_uuid(), 'privacidad', 'Aviso de privacidad', 'BORRADOR DEL PROYECTO — PENDIENTE DE REVISIÓN Y PUBLICACIÓN

1. Responsable y contacto
The Fitness Stuff es el nombre del proyecto de comercio electrónico. Antes de operar con clientes reales, el responsable debe completar su identidad legal, domicilio y canal de atención de privacidad.
[PENDIENTE: nombre o razón social del responsable, domicilio y correo para privacidad].

2. Datos tratados
La plataforma utiliza nombre, correo, credenciales de cuenta, teléfono, direcciones de entrega y datos de pedidos. También registra preferencias de cuenta, carrito, solicitudes posventa y evidencias que la persona proporcione al utilizar esas funciones. No se requiere proporcionar datos de salud para comprar; evita incluirlos en campos libres o archivos.

3. Finalidades
Los datos se utilizan para registrar y autenticar cuentas, mantener sesiones, gestionar direcciones y carritos, cotizar envíos, tramitar pedidos, verificar pagos y atender solicitudes relacionadas con las compras. Los avisos de reposición se solicitan por separado y no equivalen a una suscripción publicitaria. Cualquier finalidad publicitaria adicional debe informarse y habilitarse con el consentimiento que corresponda.

4. Proveedores y destinatarios
La cotización de envío comparte los datos necesarios del origen, destino y paquete con Envia.com y la paquetería seleccionada. Cuando se habilita el pago con Stripe, los datos de tarjeta se capturan mediante ese proveedor; la tienda no almacena el número completo ni el código de seguridad de la tarjeta. Deben identificarse los proveedores de alojamiento, comunicaciones y demás encargados efectivamente utilizados, así como los tratamientos o transferencias aplicables.
[PENDIENTE: confirmar proveedores, países de tratamiento, destinatarios y condiciones aplicables].

5. Sesiones, cookies y seguridad
La plataforma utiliza cookies de sesión y carrito y almacenamiento del navegador para funciones operativas. Las contraseñas y tokens de renovación se almacenan mediante representaciones criptográficas, no como texto legible. El acceso administrativo se restringe por permisos. Estas medidas no eliminan todos los riesgos de seguridad. Los rastreadores publicitarios o analíticos adicionales requieren información y configuración específicas antes de activarse.

6. Conservación y derechos
La persona titular puede solicitar acceso, rectificación, cancelación u oposición al tratamiento, revocación del consentimiento y limitación del uso o divulgación, conforme a las disposiciones aplicables. Corregir datos en la cuenta o desactivarla no equivale por sí solo a resolver una solicitud de privacidad; algunos registros pueden requerir conservación por obligaciones o responsabilidades.
[PENDIENTE: canal de recepción, acreditación de identidad, procedimiento, plazos de atención y criterios de conservación y supresión].

7. Cambios
Las versiones aprobadas de este aviso se consultan en /politicas/privacidad, con versión y fecha. Debe definirse el medio para informar cambios relevantes y, cuando corresponda, obtener nuevamente el consentimiento.
[PENDIENTE: procedimiento de comunicación de cambios].', 1, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'terminos', 'Términos y condiciones', 'BORRADOR DEL PROYECTO — PENDIENTE DE REVISIÓN Y PUBLICACIÓN

1. Identificación y alcance
The Fitness Stuff es un proyecto de tienda de suplementos y accesorios. Estos términos describen el funcionamiento previsto de la plataforma y deben ser completados y aprobados antes de realizar operaciones comerciales reales.
[PENDIENTE: identidad legal del proveedor, domicilio, contacto y datos comerciales aplicables].

2. Cuenta y uso
La persona usuaria debe proporcionar datos correctos y mantener la confidencialidad de sus credenciales. La plataforma permite consultar el catálogo y preparar compras como invitado o con cuenta, según las funciones disponibles. La oferta se dirige a personas adultas. No se permite el uso fraudulento de cuentas, pedidos, cupones o solicitudes.

3. Productos e información
Cada presentación se identifica por su SKU, contenido, precio y disponibilidad. Deben revisarse la etiqueta, ingredientes, indicaciones y advertencias del producto. La información del catálogo no constituye una promesa de resultados ni sustituye la información del fabricante. Solo deben ofrecerse productos y evidencias de lote efectivamente documentados.

4. Precios y promociones
Los importes mostrados al cliente se expresan en pesos mexicanos (MXN). El resumen de compra presenta productos después de descuentos, envío y total. Los cupones y promociones dependen de su vigencia, requisitos y compatibilidad. El costo por porción, cuando exista ese dato, es una referencia de comparación del producto y no incluye el envío.
[PENDIENTE: verificar información fiscal y presentación de impuestos y comprobantes antes de operar].

5. Carrito, pedido y pago
Agregar artículos al carrito no reserva existencias. Antes de confirmar se revisan dirección, productos, envío, total y políticas. Confirmar registra un pedido pendiente de pago; no significa que ya esté pagado ni enviado. El inventario se vuelve a validar y se reserva al iniciar el pago. Cuando el pago está habilitado, se utiliza Stripe para tarjetas admitidas. La confirmación del pago depende de su verificación por el servidor y no únicamente del regreso desde la página del proveedor. En pruebas no deben utilizarse operaciones reales.

6. Envío
Se requiere dirección nacional válida, cobertura y un empaque apto para el pedido. La plataforma cotiza con Envia.com y la paquetería configurada; no genera una guía por el solo hecho de cotizar. Desde $1,499 MXN de productos después de ofertas y cupón, antes de puntos, la tienda absorbe la tarifa cotizada; por debajo se cobra la tarifa seleccionada sin recargo. El envío gratuito también requiere cobertura. Las estimaciones del proveedor no garantizan una fecha de entrega. Cambiar productos, dirección o empaque puede requerir una nueva cotización y aceptación.
[PENDIENTE: confirmar operación logística, zonas y atención de incidencias].

7. Cancelaciones y posventa
Las cancelaciones, devoluciones y reembolsos se gestionan según el estado del pedido, las políticas aprobadas y los derechos aplicables. La política de devoluciones se consulta en /politicas/devoluciones. Los puntos u otras funciones solo se aplican cuando estén habilitados y se informe su alcance; no se presupone un beneficio por aparecer en una propuesta del proyecto.

8. Versiones y derechos
El pedido conserva la versión de las políticas aceptadas. Los cambios posteriores no alteran ese registro histórico. Ninguna disposición debe interpretarse como renuncia a derechos que correspondan a la persona consumidora.
[PENDIENTE: canales de atención, procedimiento de controversias y demás información comercial exigible].', 1, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'devoluciones', 'Política de devoluciones', 'BORRADOR DEL PROYECTO — PENDIENTE DE REVISIÓN Y PUBLICACIÓN

1. Solicitud de devolución
El proyecto contempla solicitudes dentro de los treinta días naturales siguientes a la entrega registrada del pedido. Debe identificarse el pedido, las unidades afectadas, el motivo y la evidencia disponible. Este plazo comercial no debe utilizarse para limitar garantías, reclamaciones o derechos que resulten aplicables por ley.

2. Condiciones y evaluación
La revisión distingue cambios de opinión de incidencias como producto incorrecto, dañado, con defecto o con problemas de integridad. Por la naturaleza de los suplementos, deben verificarse sellos, empaque, contenido y condiciones de conservación. No se debe rechazar automáticamente una incidencia por el solo hecho de que el envase esté abierto. La decisión y sus razones se registran en la solicitud.
[PENDIENTE: aprobar condiciones específicas para cambio de opinión y manejo de productos abiertos, sin restringir derechos aplicables].

3. Procedimiento
Desde las funciones de pedidos o solicitudes disponibles se registra la petición y se conserva su seguimiento. Antes de enviar artículos de regreso, solicita instrucciones y confirmación del medio de retorno. No se debe utilizar la dirección técnica del almacén como domicilio de devoluciones sin autorización operativa.
[PENDIENTE: contacto de atención, domicilio autorizado, instrucciones, costos del retorno por supuesto y plazos de respuesta].

4. Inspección y resolución
El registro de una solicitud no significa aceptación automática ni reembolso inmediato. El responsable revisará la información y, cuando corresponda, la recepción e inspección. La resolución debe distinguir las unidades aceptadas, motivo y solución aplicable. No se incorporan al inventario vendible artículos que requieran bloqueo o revisión.

5. Reembolsos
Los reembolsos autorizados se calculan sobre lo efectivamente pagado y la distribución original de descuentos, dinero y puntos, cuando estos estén habilitados. No se devuelve dos veces el mismo importe ni se anuncia como completado un reembolso todavía pendiente de confirmación del proveedor de pago. Los tiempos bancarios dependen del medio y proveedor y no se promete un plazo fijo sin confirmación.
[PENDIENTE: definir tratamiento del envío, costos de retorno, medios y plazos informados al cliente para cada supuesto].

6. Cancelación
La cancelación depende del estado del pedido y debe comprobar si ya existe un cobro o envío. Cancelar no equivale a confirmar un reembolso; sus estados pueden ser distintos. Las compras con incidencia posterior al envío se canalizan al procedimiento que corresponda.

7. Seguimiento y derechos
Conserva el número de pedido, comprobantes, fotografías y comunicaciones de la solicitud. No se requiere publicar datos sensibles en reseñas o espacios abiertos. El responsable debe completar los canales de contacto y atención antes de publicar esta política. No se excluyen los derechos aplicables por defecto, incumplimiento o garantía.', 1, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

COMMIT;
