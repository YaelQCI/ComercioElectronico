# Lotes y certificados · #12

La variante expone sus lotes vendibles en orden FEFO: caducidad, fecha de creación/recepción e identificador; artículos sin caducidad al final. Bloqueados, vencidos en fecha local del almacén y completamente reservados no aparecen como disponibles. Tarjeta indica lote orientativo y detalle enumera SKU, presentación, lote, caducidad, importación, aduana y origen realmente registrados; datos faltantes aparecen como no documentados. Precisión mensual muestra MM/YYYY, sin inventar día.

La ficha indica que estos lotes son orientativos y que la asignación definitiva del pedido puede incluir varios. Reserva/consumo y snapshots por unidad dependen de #13/#24; no se promete asignación ni se habilita compra en este avance.

Certificado pertenece a InventoryLot.certificateAssetId. No se muestra afirmación de verificación ni enlace si no hay certificado registrado. Endpoint por UUID `/api/catalog/lots/:id/certificate` exige lote de producto publicado/variante activa y verifica ubicación real dentro del directorio, firma PDF, tamaño y SHA-256 antes de devolver archivo inline con nosniff. Archivo ausente/alterado devuelve 404 explícito. No se reutiliza certificado de otro lote. No se inventó certificado-24b.pdf.

Directorio privado configurable con `NUXT_CATALOG_ASSET_DIRECTORY`; por defecto public en desarrollo y .output/public en producción desde el directorio de la release. Archivos revisados se incorporan bajo public/certificates antes del build. Si se pierde un archivo tras importarlo, la descarga falla de forma explícita en lugar de devolver otro documento.

Pruebas de FEFO/exclusiones/desempate/precisión y lectura de bytes sintéticos identificados como fixture para validar hash/ruta/faltantes. Los bytes de prueba no son un certificado comercial ni se publican como tal. Pendientes lotes/certificados reales, asignación persistente y validación interactiva en navegador.

Veinte pruebas de catálogo y build correctos; SSR con PostgreSQL aislado muestra lotes orientativos y estado sin lotes. API de certificado verifica 400 por ID inválido y 404 por lote inexistente. git diff --check correcto.
