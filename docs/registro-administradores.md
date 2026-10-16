# Registro de administradores desde el panel

Un administrador activo puede usar **Registrar administrador**, disponible sobre la navegación de secciones del panel. El modal solicita nombre, correo, contraseña, confirmación y motivo del alta. La contraseña conserva las reglas del registro habitual: al menos 12 caracteres y hasta 256 bytes. La nueva cuenta puede iniciar sesión inmediatamente; no se envía una invitación por correo.

`POST /api/admin/users` exige sesión y origen válido. El caso de uso `register-administrator.js` verifica el rol actual, valida los datos, calcula el hash y vuelve a comprobar los permisos bajo bloqueo dentro de la transacción de creación y auditoría. El registro no inicia sesión con la cuenta nueva ni modifica la sesión del administrador que realiza el alta. Un correo existente, incluso desactivado, produce conflicto sin cambiar su rol ni contraseña.

La auditoría `REGISTER_ADMINISTRATOR` conserva actor, cuenta creada, motivo y rol. No incluye contraseñas ni hashes. Si falla la auditoría se revierte también la creación. No se requiere cambio de esquema ni migración.

El modal bloquea acciones mientras guarda, mantiene los campos si hay error, limpia la contraseña al cerrar y actualiza el listado de usuarios abierto. Usa el diálogo accesible y los controles existentes del proyecto.

Verificación: 104 pruebas de PostgreSQL aislado aprobadas, incluidas cuatro nuevas sobre permisos, login, duplicados, validación y atomicidad de la auditoría. Compilación Nuxt y de imagen Linux completadas. `scripts/check-administrator-registration-browser.mjs` comprueba en Edge headless apertura, envío, error/reintento, actualización del listado, limpieza de contraseña, cierre y ancho móvil; sesión y escrituras son simuladas. La comprobación en navegador utiliza la imagen Linux, porque el servidor local de Windows y el modo dev presentan problemas previos de resolución de rutas. Estos cambios todavía no se han desplegado en EC2.
