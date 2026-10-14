# Auditoría de aceptación (#29)

14 de octubre de 2026. Windows, Node 24.12.0, PostgreSQL aislado `fitness_migration_test_final`, proveedor Stripe simulado. Ninguna prueba representa venta real, catálogo comercial aprobado ni certificación WCAG.

## Comprobaciones ejecutadas

- Build Nuxt exitoso; 56 pruebas unitarias exitosas: catálogo, variantes, filtros, paginación, precios, puntos, Stripe, credenciales y temas.
- Suite PostgreSQL: 72 de 73 inicialmente exitosas. La única falla era expectativa obsoleta de 58 tablas; se corrigió comparando los nombres del esquema vigente y se repitieron sus 16 pruebas, todas exitosas. Total cubierto: 73 casos, sin afirmar repetición completa después del cambio aislado.
- Contraste: 44 pares por tema, todos cumplen sus umbrales respectivos de texto/control. Mínimos de conjunto: claro 3.16:1, oscuro 4.44:1; no son mínimos de texto normal, cuyo umbral es 4.5:1.
- Chrome headless: 72 escenarios (nueve rutas × cuatro anchos 360/480/768/1100 × dos temas). Cero páginas 404, cero imágenes sin atributo alt y cero áreas de controles menores de 44×44 en estados visitados. Para checkbox/radio se mide etiqueta pulsable. Rutas: inicio, catálogo sin resultados, carrito, checkout, cuenta, pedidos, solicitudes, devolución y contacto.
- Selector tema: sistema, cambio, recarga y navegación Nuxt verificados. Resultado responsive conserva **dos fallos**: inicio a 1100 px en claro/oscuro reporta scrollWidth 1102 sobre viewport 1100; ningún rectángulo descendiente supera el ancho. El verificador falla deliberadamente para mantener visible ese pendiente.
- Se corrigieron corte de texto en tarjetas, token/altura de controles posventa y un error del verificador al esperar predicados síncronos.

Reproducción: compilar y servir con base aislada, configurar `TEST_HTTP_URL` local, `TEST_BROWSER_PATH` Chrome/Edge, `TEST_LAYOUT_AUDIT=true`, `TEST_AUDIT_PATH` en directorio ignorado; ejecutar `node scripts/check-theme-browser.mjs`. En este entorno CDP requirió ejecución fuera del sandbox. El JSON generado conserva métricas y elementos detectados; no versionar resultados con datos locales.

## Rúbrica y evidencia restante

|Área|Peso|Evidencia disponible|Falta para aceptación|
|---|---:|---|---|
|Funcionalidad|25%|Pruebas carrito, checkout, pagos, pedidos, posventa|Flujo browser completo, vinculación invitado, combos/lotes posventa, venta real #38|
|Datos|15%|Migraciones y restricciones; pruebas persistentes|Diez productos comerciales aprobados y persistencia del entorno final|
|Diseño/UX|15%|Tokens, contraste y barrido browser|2 px de desbordamiento, revisión visual de todas las vistas y barras fijas, teclado/lectores y textos alternativos pertinentes|
|Animaciones|10%|Estados reales de carga y cambio de tema|Demostración y mejoras #37|
|Comercio/modelo|15%|Propuesta #31, cálculos/reintegros|Políticas aprobadas y flujo operativo completo|
|Seguridad|10%|Autorización, límites, pruebas #36|Revisión exposición/dependencias y despliegue real|
|Documentación|10%|Documentos de módulos y esta cobertura|Entrega integral #39, infraestructura/operación #40/#41|

La presencia de alt no valida su calidad; una ruta accesible no demuestra todas sus interacciones. Faltan detalle con catálogo aprobado, estados aprobados/rechazados/pendientes de Stripe sandbox y producción, devolución de combo/múltiples lotes y validación de todas las animaciones. Conservar #29 abierto.
