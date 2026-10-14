# Propuesta de negocio de The Fitness Stuff (#31)

Versión 1 · 13 de octubre de 2026. Documento del proyecto académico, basado en las decisiones del equipo transcritas en [#31](https://github.com/YaelQCI/ComercioElectronico/issues/31), [plan #1](https://github.com/YaelQCI/ComercioElectronico/issues/1) y [modelo aprobado](database-model-source.md). Los originales E-commerce Project.pdf y Final Project.docx no están en este checkout; no se atribuyen aquí citas adicionales a esos archivos.

## Oferta, público y modelo

The Fitness Stuff propone una tienda B2C de suplementos importados para personas adultas que practican entrenamiento de fuerza o actividad física y quieren comparar presentaciones, costo por porción y evidencia de los lotes antes de comprar. El público descrito es una hipótesis comercial del equipo, no una segmentación respaldada por una encuesta o ventas existentes.

El catálogo se organiza por categorías y filtros transversales de objetivos/disciplinas. Creatina y las categorías mencionadas en el prototipo son referencias de la oferta propuesta; no prueban existencia, autenticidad, permisos ni disponibilidad de productos. Solo se publicarán productos documentados con nombre, descripción, precio, imágenes, variantes/SKU, información nutrimental y lotes. El mínimo académico de diez productos distintos todavía requiere datos del propietario.

La propuesta de valor combina comparación por porción, selección de presentación, disponibilidad verificable y trazabilidad por lote. Un certificado se mostrará solo si pertenece al lote y el archivo está disponible. No se publican garantías de autenticidad, beneficios médicos ni plazos de entrega sin evidencia y aprobación.

El ingreso previsto es el margen de reventa de productos y combos fijos. La venta es directa al consumidor; no hay marketplace ni suscripción VIP vigente. El costo debe considerar adquisición/importación, operación, empaque, comisiones del proveedor, descuentos, puntos, atención y subsidios de envío. No hay cifras definitivas de margen, volumen o rentabilidad. Antes de publicar un SKU, el responsable debe revisar costos y precio; descuentos y envío gratuito no garantizan margen positivo.

Los combos tienen composición y precio configurados. Los puntos son una capacidad futura: 1 punto por cada $10 MXN elegibles pagados con dinero, acreditado al entregar y vincular a cuenta; 1 punto equivale a $0.10 MXN para productos, nunca envío. No se anuncia un saldo ficticio ni una membresía VIP.

## Recorrido del cliente y fricciones

| Etapa | Necesidad / fricción | Solución prevista | Estado en el código al redactar |
| --- | --- | --- | --- |
| Descubrimiento | Conocer la oferta sin promesas engañosas | Contenido educativo en TikTok/Instagram; colaboración propuesta con gimnasios y microinfluencers | Estrategia documentada; campañas no activadas |
| Exploración | Encontrar un producto entre presentaciones | Inicio por selección configurada; búsqueda por nombre/SKU/categoría, filtros combinados y paginación | Módulos existentes; catálogo comercial pendiente |
| Evaluación | Comparar precio, porciones y evidencia | Precio vigente/oferta, costo por porción, galería y lotes con certificado propio | Cálculos y vistas existentes; evidencia real pendiente |
| Carrito | Conservar selección y entender el total | Carrito persistente, cantidades, guardados, cupones y cotización | Funciona para visitante; integración de cuenta pendiente |
| Checkout | Evitar sorpresas y pérdida de existencias | Datos de entrega, resumen definitivo, recotización aceptada y reservas conjuntas de 30 minutos | #23/#24 pendientes; pagar está deshabilitado |
| Pago | Conocer si se cobró y poder recuperar un fallo | Tarjetas vía Stripe, webhook verificado e idempotencia; total cero sin cobro ficticio | #25/#30 pendientes |
| Entrega | Ver plazo y seguimiento sin garantía inventada | Estimación del servicio cotizado y estados reales del pedido | #35 pendiente; Envia solo cotiza, nunca genera guías |
| Poscompra | Resolver incidencias y mantener historial | Cuenta, puntos, reseña verificada, devolución y Price Match con seguimiento | #21/#26/#28 pendientes |

La compra como invitado está acordada. Vincularla posteriormente a una cuenta exige verificar control del correo, sin apropiarse del historial por conocer un número de pedido. Los cambios posteriores del carrito deben conservarse al confirmar una compra. No se confunde agregar al carrito con reservar inventario o completar una venta.

## Marketing y experiencia

TikTok e Instagram se proponen para descubrimiento por su formato visual: explicar cómo comparar etiquetas, presentaciones y costo por porción. Gimnasios y microinfluencers son canales propuestos para llegar a comunidades de entrenamiento; colaboraciones requieren acuerdos y revisión de mensajes. Ningún canal tiene presupuesto, proveedor o campaña autorizados en este documento.

La búsqueda orgánica se apoya en fichas con títulos descriptivos y datos verificables, evitando duplicar páginas por cada objetivo. La experiencia debe mantener navegación por teclado, móvil, foco visible, ambos temas y mensajes de carga/error; estas verificaciones completas corresponden a #29.

Retargeting, newsletters y consejos son propuestas futuras. No se instalan rastreadores ni se envían mensajes por documentarlas. Requieren finalidad, consentimiento cuando corresponda, baja accesible y revisión del tratamiento de datos. El aviso de reposición solicita consentimiento específico; no equivale a una suscripción publicitaria.

Se propone medir visitas a catálogo, búsqueda sin resultados, avance producto → carrito → checkout, abandono, pago confirmado, incidencias y repetición de compra. Deben distinguirse pedidos pagados, cancelados y reembolsados. No se inventan tasas de conversión; la instrumentación y su política se aprobarán antes de activarse.

## Privacidad, seguridad y decisiones de publicación

El proyecto necesita datos de contacto/entrega para cumplir pedidos y credenciales para cuentas. El diseño contempla hashes de contraseñas y tokens, autorización en servidor, sesiones revocables, cookies seguras, secretos privados, HTTPS y acceso mínimo. Stripe capturará las tarjetas; la tienda no guardará PAN/CVC. Estas decisiones se implementan y verifican en #23/#30/#36/#41; una tabla o variable de entorno no prueba que el control esté operativo.

[#27](https://github.com/YaelQCI/ComercioElectronico/issues/27) debe publicar privacidad, términos, devoluciones y contacto aprobados, con versión/fecha. El responsable debe revisar obligaciones de venta, información comercial, importación/etiquetado, publicidad y tratamiento de datos aplicables antes de operar. Este documento no certifica cumplimiento legal ni sustituye esa revisión. Soft delete conserva historial y no equivale a atender una solicitud de privacidad.

[#28](https://github.com/YaelQCI/ComercioElectronico/issues/28) implementará las reglas acordadas: Price Match solicitado dentro de siete días con evidencia y revisión; devoluciones hasta treinta días desde entrega, con condiciones y excepciones por incidencia; inspección previa al reembolso y reparto original dinero/puntos. No se promete reembolso en cinco días ni resolución automática. Los textos públicos deben coincidir con las capacidades habilitadas.

Envío gratis desde $1,499 MXN de productos tras ofertas/cupón y antes de puntos; por debajo se cobra la tarifa seleccionada sin recargo. Incluso gratis requiere caja y cobertura. Envia.com se limita a cotizar. Las estimaciones no son garantías; almacén, medidas y cajas requieren configuración real. La entrega local de la propuesta no autoriza un plazo fijo.

## Coherencia y aceptación de #31

Se contrastó esta propuesta con `StoreHome.vue`, `ProductDetail.vue`, `CartView.vue`, las rutas de políticas, los módulos de catálogo/envío/reposición y [arquitectura](architecture.md). La aplicación mantiene deshabilitado el pago y las políticas indican contenido pendiente; este documento distingue esos límites de los servicios futuros. No hay catálogo, contactos, campaña ni ventas ficticias presentados como definitivos.

Los cinco criterios de #31 quedan documentados: oferta/público/modelo; recorrido y fricciones; estrategia justificada; privacidad/seguridad y enlaces a #27/#28; propuesta versionada y coherencia con el código. Las implementaciones comerciales y aprobaciones externas conservan sus propios issues; no son evidencia de ventas ni requisitos satisfechos por esta propuesta.
