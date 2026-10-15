# Preferencia de apariencia de la cuenta (#22)

La configuración está en **Mi cuenta → Apariencia**, disponible después de iniciar sesión. Permite elegir **Claro**, **Oscuro** o **Del sistema**, y guardar explícitamente la elección. Se retiró el selector de la cabecera y de `/sistema-visual`; esta última enlaza a Mi cuenta.

## Persistencia y aplicación

- `User.themePreference` almacena `light`, `dark` o `system` en PostgreSQL. Su valor inicial es `system`, también para las cuentas existentes.
- La migración `20261015190000_account_theme_preference` agrega la columna y una restricción CHECK. No modifica migraciones previas ni borra datos.
- `PATCH /api/account/theme` requiere sesión y Origin propio. El ID de la cuenta se obtiene de la sesión; el cliente únicamente envía `themePreference`. La validación permite exclusivamente los tres valores.
- La respuesta pública de cuenta incluye la preferencia. `app/app.vue` consulta la sesión con la clave compartida `account-session` y aplica `data-theme` mediante `useHead` desde SSR. El perfil refresca esa misma sesión al iniciar/cerrar sesión o guardar la apariencia.
- Los tokens CSS existentes aplican los colores. `system` usa `color-scheme: light dark`, por lo que los cambios del sistema se siguen mediante CSS, sin controlador JavaScript.
- No se lee ni escribe `localStorage` ni una cookie de tema. Una entrada antigua `fitness_theme`, si existe en un navegador anterior, se ignora. No se importa automáticamente a la cuenta porque podría pertenecer a otra persona que utilizó ese navegador.
- Sin sesión se utiliza el tema del sistema. Al cerrar sesión se vuelve a ese modo y al iniciar sesión con otra cuenta se aplica su preferencia.
- Otra sesión/dispositivo recupera la preferencia al consultar nuevamente la cuenta o recargar. No hay notificaciones en tiempo real entre pestañas ni dispositivos ya abiertos.

## Demostración

1. Iniciar sesión en http://localhost:3001/cuenta.
2. En Apariencia, elegir Oscuro y pulsar Guardar apariencia.
3. Navegar al catálogo y recargar: se conserva la apariencia de la cuenta.
4. Iniciar sesión con la misma cuenta en otro navegador o ventana privada y comprobar que recupera Oscuro.
5. Elegir Del sistema y guardar; cambiar la apariencia del sistema operativo para observar el seguimiento automático.
6. Cerrar sesión: la tienda vuelve a la apariencia del sistema. Una cuenta diferente conserva su propia elección.

## Verificación del 15 de octubre de 2026

Build Docker y migración aplicados correctamente. 54 pruebas unitarias y 76 pruebas PostgreSQL aisladas correctas, incluyendo persistencia, valor inicial, recuperación por login, aislamiento de cuentas, rechazo de valores inválidos, restricción SQL y cuenta desactivada.

HTTP/SSR: tres opciones, acceso sin sesión rechazado, valor inválido rechazado, sesión independiente con preferencia recuperada y tema global en HTML de cuenta/catálogo. La preferencia temporal utilizada para esta comprobación se restauró y sus sesiones se cerraron.

La revisión visual e interacción con el selector en navegador no se ejecutó en esta sesión. El script `scripts/check-theme-browser.mjs` se adaptó a invitados que siguen el sistema; su comprobación de sintaxis pasó, pero no se ejecutó con navegador. Las verificaciones históricas del selector basado en localStorage ya no describen este comportamiento.
