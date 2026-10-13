# Galería · #11

Galería con imagen activa, caption anunciado, miniaturas con botones y aria-pressed, operables mediante Tab/Enter/Space y tacto. Selección se conserva solo mientras la imagen siga perteneciendo a la variante actual. Medios específicos FRONT/NUTRITION sustituyen al genérico del mismo tipo; nunca se utiliza un medio de otra variante.

Tarjetas muestran reverso nutrimental al hover y al enfocar su botón, con control explícito para cambiar frente/reverso en tacto. UiImage ofrece fallback ante archivo faltante y vuelve a intentar al cambiar src; proporciones y dimensiones reservadas. Galería principal eager, miniaturas/tarjetas lazy. Fondo packshot permanece blanco en ambos temas.

No se inventaron imágenes ni certificados. El manifiesto de #3 admite medios FRONT/NUTRITION/GALLERY; fotografías de sello/scoop u otras evidencias se etiquetan con alt correcto solo si son reales. El modelo actual no asocia ProductMedia a un lote, por lo que no se presenta una foto genérica como prueba de un lote concreto; esa asociación exige datos/modelo específicos. Certificado sí pertenece al lote en #12.

Prueba de selección de medios propios/genéricos y exclusión de otras variantes. Pendiente catálogo/archivos reales y verificación visual, teclado/tacto/fallback de imagen en navegador conectado (no disponible).

Dieciocho pruebas de catálogo y build correctos. No se afirma prueba interactiva por haber pasado el build. Hover se limita a puntero mouse y vista de foco a focus-visible para que el primer toque del control no se invierta por eventos de foco/hover sintéticos.
