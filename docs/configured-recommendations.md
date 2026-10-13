# Relacionados y combos (#17)

Ficha y carrito consultan ProductRelation RELATED/CROSS_SELL configuradas en PostgreSQL. Se excluyen fuente/destino despublicados, variantes eliminadas y SKU ya activos, incluidos los componentes de combos. Agotados muestran su disponibilidad y no permiten agregar; no se inventan sugerencias ni personalización cuando no hay relaciones.

La vista del carrito ofrece combos reales de composición fija, precio propio, desglose de SKU/cantidades, ahorro frente al precio individual vigente y suma de porciones cuando todos los componentes tienen ese dato. Disponibilidad usa el componente limitante con lotes aptos, descontando reservas. Agregar valida demanda conjunta con unidades y otros combos. El contador global cuenta piezas físicas de componentes; número de líneas/compras de combo permanece separado. Guardar/restaurar admite combos usando las mismas reglas.

El módulo puro obtiene asignaciones exactas de centavos según precio individual y versión de composición. No ofrece combos sin referencias suficientes para prorratear un precio positivo. No existe inventario independiente de combo y el carrito no reserva ni descuenta movimientos. Cupones actualmente sin habilitar; exclusión por defecto debe conservarse al integrar #19.

Validación: 25 pruebas puras de catálogo y ocho pruebas PostgreSQL del carrito/recomendaciones, incluyendo componente limitante, prorrateo exacto, porciones ausentes, demanda de combo + unidades, piezas físicas, relaciones explícitas y exclusión de SKU/despublicados. Build Nuxt y HTTP/SSR se verifican antes del commit.

Pendiente: snapshot persistente de composición/precios/asignación por unidad y descuento definitivo de inventario al confirmar pedido en #24/#25; devoluciones parciales en #28; herramientas de configuración autorizadas en #34. Las primitivas FEFO #13 funcionan con OrderUnit por variante, pero aún falta construir el pedido desde estos combos. No se considera verificado el ciclo completo de compra. Validación visual y datos comerciales definitivos siguen pendientes.
