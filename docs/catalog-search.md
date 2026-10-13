# Búsqueda · #6

La cabecera conserva `q` en la URL y sincroniza el input al navegar o recargar; conserva parámetros del catálogo y elimina `pagina` cuando cambia la búsqueda. Consulta vacía explora el catálogo. La API valida tipo/longitud y busca coincidencia literal de la frase normalizada en nombre, SKU o categoría activa mediante PostgreSQL, con parámetros SQL y sin requerir extensiones. Unicode NFKD, eliminación de marcas y minúsculas permiten buscar sin acentos; `%`, `_` y barra invertida se escapan como texto literal.

La búsqueda ocurre antes del límite de lectura y respeta publicación, soft delete y variantes/marcas activas. Estado pendiente oculta resultados anteriores, error ofrece reintento y cero coincidencias permite limpiar q preservando otros parámetros. Filtros y orden/paginación se conectan en #7/#8. La implementación de esos issues completará la combinación exigida por #6.

Validación: seis pruebas de catálogo (cuatro de manifiesto y dos de normalización/entradas), una prueba real PostgreSQL de nombre/SKU/categoría con acentos, ocultación de borradores y búsqueda literal de comodines. Build Nuxt correcto; interacción y navegación atrás en navegador quedan pendientes de #29.
