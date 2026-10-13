# Inicio conectado · #5

Inicio delegado a `app/features/catalog/StoreHome.vue`, con hero, acceso al catálogo, selección y categorías desde `/api/catalog/home`. Selección configurable por `Product.featuredPosition`; orden estable por posición/UUID, máximo ocho productos. No se presenta como ranking de ventas. Categorías activas con conteos de productos publicados/no eliminados y variantes activas, calculados en PostgreSQL; no se utilizan los contadores ilustrativos del prototipo.

Las tarjetas comparten precios de #4 y enlaces al UUID del producto. Estado vacío para selección/categorías y error recuperable con retry. No se añaden promesas de autenticidad, envío hoy o Price Match sin servicios/datos que las respalden. Las condiciones de envío, Price Match, lotes/caducidad, acciones de carrito y aviso de reposición se completarán con #13/#14/#18/#20/#28. La aplicación de categorías se conecta en #7.

Pendiente catálogo definitivo de diez productos, selección revisada, inventario y flujos comerciales. El propietario confirmó que estos datos no existen todavía. No se publicaron productos ficticios. Este avance no cumple por sí solo todos los criterios del issue.

Validación: prueba con PostgreSQL aislado de selección explícita, límite de ocho y conteos por categoría; build Nuxt y git diff --check correctos; inicio SSR/API 200 con datos de esa base de prueba. Validación visual e interacción siguen pendientes.
