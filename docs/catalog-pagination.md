# Orden y paginación · #8

El catálogo filtra el conjunto completo publicado, ordena con desempate estable por UUID y luego pagina de 12 en 12. Precio utiliza el mínimo de las presentaciones que cumplen los filtros; esas mismas presentaciones alimentan el precio mostrado en la tarjeta. Costo por porción compara el mínimo como razón exacta y coloca variantes sin porciones documentadas al final en ambos sentidos. Novedad usa publishedAt, no una fecha inventada ni updatedAt.

Relevancia con q: SKU exacto > nombre exacto > prefijo de nombre > coincidencia en nombre > categoría. Sin q: selección por featuredPosition, luego UUID. No se afirma que relevancia represente ventas o popularidad.

Ordenes de URL: relevancia, precio-asc, precio-desc, porcion-asc, porcion-desc, novedades. Página (`pagina`) inválida se corrige a uno; superior al final se limita al último. Catálogo vacío tiene página uno, cero páginas e intervalo 0–0. La interfaz corrige la URL con replace, conserva búsqueda/filtros/orden al paginar y reinicia página al cambiar búsqueda/filtros/orden. Anterior/Siguiente deshabilitados en los extremos. Números próximos al actual y extremos evitan renderizar miles de enlaces.

API devuelve total, pages, page, pageSize, start/end y order junto a los resultados y opciones. Se evita el falso vacío de páginas fuera de rango. Pruebas: 48 registros sintéticos producen cuatro páginas; límites/entradas inválidas; empate estable; precisión por porción; relevancia SKU; novedades y precio de variantes filtradas. Interacción en navegador pendiente por falta de navegador conectado.

Validación: catorce pruebas de catálogo correctas, build y git diff --check correctos. API compilada con base aislada corrige pagina=999 al último resultado, conserva total real y devuelve intervalo SSR correcto; búsqueda sin coincidencias conserva total cero/página uno/intervalo cero.
