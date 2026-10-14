# Animaciones e interacciones (#37)

Inicio: entrada CSS escalonada breve de hero (240 ms, retrasos 0–150 ms), sin ocultar permanentemente contenido ni añadir librerías. Agregar desde destacados bloquea operaciones mientras se procesan y muestra éxito anunciado con enlace al carrito, o error con role alert. Esto corrige la falta de feedback local en inicio.

Catálogo: tarjetas conservan reverso nutrimental por hover de ratón, foco y botón pulsable con aria-pressed para teclado/tacto. Selección de filtros usa URL y estados pendientes reales. Detalle: transición de opacidad de galería (100 ms por fase), leyenda anunciada, miniaturas con aria-pressed; selección de variante/stock proviene del servidor. Carrito mantiene feedback de operaciones reales, bloqueo mientras escribe y errores recuperables. Acordeones nativos details/summary animan opacidad de apertura, preservando teclado. Hover/foco utiliza transición corta de color, sin cambiar tamaños de controles.

Todas las nuevas animaciones y transiciones están limitadas a prefers-reduced-motion:no-preference. Con reduce, contenido y operaciones funcionan inmediatamente; carga existente ya usa motion-safe. No hay skeleton permanente ni datos ficticios añadidos.

Demostración reproducible: abrir inicio con productos de un catálogo aprobado; agregar con teclado/tacto y observar mensaje o error; ir a catálogo, aplicar filtro y alternar reverso; abrir detalle y elegir miniatura/presentación; editar carrito y abrir acordeón. Repetir con movimiento reducido y anchos 360/480/768/1100. Usar stock real disponible, no presentar fixture como catálogo de la tienda.

Pendiente: grabar y verificar estas interacciones en navegador con catálogo aprobado, varios estados de stock y ambos temas; medir rendimiento del entorno final. Build valida compilación, no demuestra interacción. La auditoría #29 conserva pendiente de desbordamiento de inicio a 1100 px.
