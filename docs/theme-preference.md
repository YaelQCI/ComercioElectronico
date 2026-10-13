# Preferencia de apariencia (#22)

El selector de la cabecera y `/sistema-visual` cambia el tema global y anuncia el estado. Permite volver al tema del sistema. La elección se guarda en `localStorage` (`fitness_theme`), se sincroniza entre pestañas y se conserva durante navegación y recarga. Sin elección válida, sigue `prefers-color-scheme`, incluidos cambios del sistema. Si el navegador bloquea almacenamiento, funciona durante la visita.

`app/features/appearance/theme.js` se incorpora como script síncrono en el head SSR para resolver `data-theme` antes de pintar. El control espera montaje para mostrar la acción calculada sin discrepancias de hidratación. `/sistema-visual` usa el mismo control y no sobrescribe la preferencia al navegar.

Todos los componentes usan los tokens de `tokens.css`; `light-dark()` aplica el esquema a campos, foco, tablas y barras, manteniendo packshots blancos. No se anima el cambio de colores.

Validación realizada el 13 de octubre de 2026:

- Cuatro pruebas del controlador: sistema dinámico, restauración, selección manual, vuelta al sistema, almacenamiento bloqueado, valores inválidos y sincronización.
- `npm run check:contrast`: 88 parejas aprobadas entre ambos temas.
- Instalación `npm ci` y build Nuxt con Node 24.12.0: correctos. Se regeneró el lockfile para resolver dependencias opcionales/peer incompletas sin cambiar versiones directas.
- Chrome headless sobre el build: selección, recarga, navegación Nuxt, modo automático, cambios del sistema y ancho móvil 390 px sin desbordamiento. Captura móvil oscura inspeccionada.

Para repetir con el servidor local iniciado, configurar `TEST_HTTP_URL` y `TEST_BROWSER_PATH`, y ejecutar `node scripts/check-theme-browser.mjs`. `TEST_SCREENSHOT_PATH` permite guardar una captura fuera de Git. No necesita instalar Playwright. Las pruebas no cuantifican el destello perceptible ni sustituyen un recorrido completo de accesibilidad de #29.
