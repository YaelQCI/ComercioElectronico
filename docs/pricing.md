# Cálculos de precios · #4

`shared/features/pricing/prices.js` contiene reglas puras de precios utilizadas por la interfaz y disponibles para los casos de uso del servidor. Este módulo compartido por capacidad de negocio evita duplicar cálculos entre navegador y servidor, sin importar dependencias de Nuxt, Vue o Prisma. Los importes se representan internamente con BigInt y se serializan como cadenas de centavos MXN.

- Costo por porción como razón exacta, incluyendo porciones decimales. Se redondea half-up solo para mostrar dos decimales. Presentaciones sin porciones documentadas no participan en comparaciones.
- Precio anterior solo si supera el vigente. El ahorro de lista es informativo y no se resta nuevamente del subtotal vigente.
- Comparación de todas las variantes por multiplicación cruzada, sin redondear antes de escoger el mínimo; todos los empates exactos se destacan.
- Reparto proporcional por residuo mayor; empates por identificador estable en orden lexicográfico, independiente del orden de entrada. Suma exacta de centavos.
- Combos con precios individuales y cantidades del momento del cálculo; snapshot/persistencia se incorporan al crear el pedido. No se promete ahorro si el precio del combo supera la suma individual.
- Carrito: precio vigente → único cupón sobre elegibles → envío gratis desde 149900 centavos tras cupón → puntos (1 décima = 1 centavo) sobre productos → envío. Los puntos pueden cubrir productos por completo, pero no el envío; saldo insuficiente o canje superior al importe se rechaza. Cotización sigue siendo necesaria aun con envío gratuito. Validación comercial de cupones en #19 y saldo real en #26; estos cálculos no constituyen autorización de compra.

Interfaz integrada: tarjetas del catálogo, ruta por UUID `/producto/:id`, selector de presentación y tabla comparativa usan las mismas reglas. Páginas delegan a `app/features/catalog/`. El catálogo consulta la API PostgreSQL de #3; no contiene productos ficticios. La compra permanece deshabilitada hasta completar inventario/carrito/checkout.

Pruebas: 9 escenarios, incluyendo importes mayores al límite entero seguro de Number, porciones decimales, diferencias ocultas por redondeo, empates, distribución independiente del orden, ahorro del prototipo sin doble descuento, umbral después del cupón, cobertura completa con puntos y 99 combinaciones de sumas no negativas.

Build Nuxt correcto. SSR con base aislada: catálogo 200 con enlaces por UUID, detalle de fixture publicado 200 con precio MXN y tabla, producto inexistente 404. No se afirma validación visual/interactiva en navegador.

Pendientes del issue: integrar cálculos en el carrito persistente, componentes/snapshots de combos y checkout cuando existan esos módulos, y verificar presentaciones comerciales documentadas. El propietario confirmó que aún no hay catálogo definitivo.
