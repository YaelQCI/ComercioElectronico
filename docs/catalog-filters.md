# Filtros combinados · #7

Estado único en URL para casillas, chips, contador y resultados. OR dentro de cada grupo; AND entre categorías, objetivos, disciplinas y grupos de variantes. Precio/porción/presentación/stock deben coincidir sobre la misma variante para evitar combinar precio de una presentación con stock de otra.

Parámetros: `categoria`, `objetivo`, `disciplina`, `presentacion` (valores repetidos o separados por coma); `stock` disponible/agotado; `porcion` menos-15/15-30/mas-30; `precioMin` y `precioMax` en MXN, con hasta dos decimales. Límite por grupo: 30 valores. Rangos por porción se comparan como razones exactas; 15 y 30 son inclusivos en el grupo intermedio. Precio mínimo <= máximo. Entradas inválidas producen 400. Opciones de taxonomía/presentaciones provienen del catálogo completo publicado.

Filtro móvil plegable mediante details/summary nativo, etiquetas de casillas, regiones/chips accesibles; cambios y limpieza preservan q/otros parámetros y reinician pagina. Estado vacío conserva filtros y permite limpiarlos. Navegación por categoría ya aplica el filtro a los datos.

Disponibilidad de lectura: suma onHandQty-reservedQty de lotes aptos no bloqueados ni vencidos en la fecha local del almacén. onHandQty ya excluye no vendibles, cuyo contador es separado. Fechas NULL representan artículos sin caducidad según #33. Reservas aún no reconciliadas siguen restando conservadoramente; #13 implementará reserva/consumo/reconciliación. Esta lectura no autoriza compra ni anuncia envío hoy.

Para el tamaño esperado del proyecto, filtros exactos se ejecutan sobre DTOs del catálogo publicado antes de paginar. Se protege con máximo 10000 productos; excederlo produce error explícito, sin truncar y devolver conteos falsos. Catálogos mayores requieren trasladar la consulta a índices SQL. Orden/paginación se incorporan en #8.

Validación: cuatro pruebas de OR/AND, misma variante, rangos exactos, entradas inválidas y disponibilidad por fecha local/reservas. Comprobación visual/teclado/tacto sigue pendiente de #29.

Build correcto; diez pruebas de catálogo y cinco pruebas de integración relacionadas con Prisma/PostgreSQL pasaron. API/SSR con base aislada: filtro de categoría oculta borradores, stock aplicado, chips/contador presentes y rango inverso devuelve 400. Inventario de herramientas de navegador vacío: no se afirma validación visual. git diff --check correcto.
