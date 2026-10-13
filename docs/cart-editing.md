# Edición y resumen del carrito (#15)

Las líneas muestran imagen de la presentación (con fallback), SKU, precio vigente, cantidad y total exacto. Los controles menos, más y entrada manual usan enteros y disponibilidad conjunta; menos queda deshabilitado en uno. Quitar elimina la línea y el último producto cambia a vacío. El contador global, resumen y barra móvil comparten el resultado de PostgreSQL. Toda actualización verifica token, propiedad de línea y versión bajo bloqueo del carrito; stock insuficiente revierte el cambio.

El máximo de cada línea resta la demanda de otros combos/unidades que consumen la misma variante. No se reservan productos. Se permite quitar líneas aunque otras selecciones estén agotadas o despublicadas. Cambiar contenido invalida cotizaciones disponibles/aceptadas para la siguiente compra. La lectura consulta precios/publicación/stock vigentes; una observación opcional en localStorage permite avisar cambios entre visitas. Ese registro nunca determina precio, identidad o autorización; si está corrupto o el almacenamiento está bloqueado, PostgreSQL sigue siendo la fuente de verdad.

El total indica explícitamente productos, provisional y envío pendiente. Cupones, puntos y cotización real deben conectarse en sus issues; no se representan como descuentos disponibles. Los lotes del catálogo son orientativos; asignación definitiva al iniciar pago. Checkout deshabilitado mientras falta su integración.

Validación: cuatro pruebas PostgreSQL del carrito, incluyendo edición/eliminación, propiedad y versión, límites, revalidación, demanda agregada y vacío. El script HTTP incluye PATCH/DELETE. Build y comprobación SSR/HTTP no sustituyen revisión visual/teclado/tacto en navegador.

Pendiente: vinculación de descuentos/cotización/puntos y conservación de cambios posteriores del carrito al confirmar un pedido (#19/#24/#26/#44). El carrito actual no se elimina al comenzar un intento de pago. Al conectar la confirmación deberán conservarse identificadores/cantidades compradas en el snapshot de checkout y descontar solo esas unidades, sin vaciar toda la cesta. Este criterio aún no se considera implementado.
