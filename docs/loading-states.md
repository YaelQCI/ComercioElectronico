# Estados de carga, vacío y error · #9

Skeleton compartido `UiLoading` solo durante la petición pendiente, con texto anunciado y figuras decorativas ocultas del árbol accesible. Animación respeta prefers-reduced-motion. Inicio, catálogo y detalle muestran estados reales de useFetch; resultados anteriores quedan fuera de la rama visible durante carga/error.

Catálogo sin publicaciones se diferencia de búsqueda/filtros sin coincidencias mediante catalogTotal. La búsqueda vacía conserva los parámetros y ofrece limpieza; filtros inválidos (400) ofrecen corregir la URL mediante limpieza y fallos de servicio (503) ofrecen reintento. No se muestran errores SQL ni cifras ilustrativas. Página de error propia para producto/página inexistente y fallo general, con recuperación al catálogo y sin detalles internos.

La página actual de carrito no muestra pago ni resumen inventado; queda pendiente integrar estado vacío/conteo real de carrito y cabecera con el módulo persistente de #14/#15. No se afirma que el carrito esté implementado.

Validación de skeleton e interacción con solicitudes demoradas requiere navegador conectado, no disponible en esta sesión. SSR/API comprueban ramas finales vacío/sin coincidencias/error/404. El issue permanece abierto por carrito e interacción.

Build y git diff --check correctos. Se creó una base privada vacía `fitness_migration_test_empty_ui` con la migración versionada y se verificó SSR de catálogo vacío, filtros inválidos y producto 404. Un servidor separado con conexión intencionalmente no disponible mostró reintento sin exponer URL PostgreSQL ni errores de Prisma. No se modificó la base comercial.
