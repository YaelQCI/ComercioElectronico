# Guardar para después (#16)

Las líneas conservan variante/combo y cantidad en estado SAVED dentro del mismo carrito persistente. Guardar y restaurar son transacciones que bloquean propietario/versión y consolidan por artículo/estado; los guardados no influyen en importes, piezas, envío gratis ni puntos. Guardar nunca reserva stock y permite conservar un artículo agotado/despublicado. Restaurar vuelve a consultar precio, vigencia y demanda conjunta de componentes y unidades; un rechazo conserva intacta la lista guardada. No se duplican líneas.

Con carrito activo vacío, la vista mantiene la lista guardada y acceso al catálogo. Se puede quitar el guardado aun si está despublicado. Precio mostrado siempre vigente. Si la cantidad guardada supera las existencias, restaurar se deshabilita y el servidor también lo rechaza.

Validación: seis pruebas PostgreSQL del carrito; guardado/restauración, consolidación, rollback por stock, soft delete y ausencia de reservas. Script HTTP verifica SAVE/RESTORE y SSR de activo vacío con guardados. Build aprobado antes de registrar implementación.

Pendiente: conectar la opción de avisos reales de reposición (#20), cuentas (#23) y validación visual/tacto/teclado. La interfaz explica que los avisos aún no están habilitados. No existen registros comerciales definitivos; las pruebas usan fixtures aisladas.
