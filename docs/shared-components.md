# Inicio de implementación · issue #2

Base compartida: layout, cabecera sticky, menú móvil desplegable con botón/aria-expanded, cierre con Escape y al navegar, búsqueda hacia URL de catálogo, pie, botones, iconos currentColor y breadcrumbs. Usa tokens y fuentes de #42; guía naranja sustituida por azul/amarillo.

Rutas iniciales: `/`, `/catalogo`, `/carrito`, y políticas pendientes bajo `/politicas/*`. Catálogo y carrito son bases de navegación, no módulos comerciales terminados. Búsqueda conserva `q`; categorías usan `categoria`; todavía no filtran productos. Objetivos y disciplinas se implementarán como filtros transversales.

Contacto mediante `NUXT_PUBLIC_CONTACT_EMAIL`, `NUXT_PUBLIC_CONTACT_PHONE` y `NUXT_PUBLIC_SERVICE_HOURS`. No se activaron los datos ilustrativos del prototipo como contacto real. Políticas muestran que su contenido aún está pendiente de #27.

Pendiente para completar #2: tarjetas/tablas/controles compartidos, detalle dinámico con identificadores de productos, migración visual completa del prototipo y comprobación de menú/teclado/tacto en navegador a 480/768/1100 px. Catálogo real y acciones de carrito dependen de los issues de datos y compra. Este avance no afirma esos criterios como terminados.

Validación del avance: `npm.cmd run build` correcto; respuestas SSR 200 para inicio, catálogo por categoría, carrito y privacidad, con cabecera, pie y un único elemento main; política desconocida responde 404. `git diff --check` correcto. La interacción y apariencia en navegador siguen pendientes.
