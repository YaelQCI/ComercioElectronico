# Detalle y selección · #10

Ruta por UUID carga únicamente el producto solicitado; ausente/borrador/eliminado produce 404. Sabor y presentación provienen de variantes reales; selección guardada en `variante` de URL. Cambio de sabor conserva presentación cuando existe o elige una del sabor solicitado. Variante de otro producto o desconocida no se sustituye silenciosamente: estado explícito con enlace para recuperar selección.

SKU/precio/costo por porción/disponibilidad/imagen frontal se derivan de la misma variante. Cantidad valida enteros desde uno hasta stock, sin tope diez; helper admite restar demanda ya presente en carrito/combos. Compra está deshabilitada hasta #14 y todavía no se conecta esa demanda persistente. Variante agotada no permite editar cantidad ni comprar. Aviso de reposición pendiente de #20.

Acordeones nativos de descripción, uso, ingredientes, alérgenos y condiciones; no se inventan políticas. Tabla nutrimental solo interpreta filas documentadas `nutritionData.rows: [{name, amount, unit}]`; no interpreta ni inventa cifras a partir de imágenes. Resumen fijo móvil usa exactamente variante/cantidad/precio del panel principal, con compra deshabilitada y espacio inferior en el layout para evitar tapar el pie. Galería/evidencia de lotes en #11/#12.

Pruebas puras de selección válida/inválida, cantidad mayor a diez y demanda agregada, entradas no enteras, stock cero y filas nutrimentales incompletas. Pendiente catálogo real, carrito/avisos, evidencias de lote y validación interactiva/móvil (sin navegador conectado).

Diecisiete pruebas de catálogo correctas y build correcto. SSR de detalle con fixture PostgreSQL aislada muestra selectores/cantidad/agotado; variante ajena muestra estado explícito. git diff --check correcto. Resumen fijo y cambios de controles no se verificaron visualmente.
