# Tokens visuales · issue #42

La fuente activa es `app/assets/css/tokens.css`. La paleta clara procede del issue #42 (transcripción del PDF); valores oscuros y complementarios proceden del CSS facilitado por el equipo, preservado sin cambios en `references/styles.original.css`. La guía naranja no se utiliza.

## Tailwind 4.3.3

Integración existente mediante `@tailwindcss/vite` en `nuxt.config.js`. Se configura con CSS (`@theme` y `@theme inline`), sin `tailwind.config.js` de Tailwind 3. Se deshabilita la paleta por defecto para evitar colores ajenos a la identidad. [Variables de tema oficiales](https://tailwindcss.com/docs/theme).

Los colores usan `light-dark()` y `color-scheme`: respetan el sistema por defecto; `data-theme="light"` o `data-theme="dark"` en `<html>` fuerza una selección. #22 debe resolver y persistir la preferencia global antes de pintar la página. Los componentes no necesitan duplicar clases para cada tema. El selector de `/sistema-visual` solo demuestra los dos modos y no guarda preferencias.

## Nombres y usos

Cada nombre genera utilidades `bg-*`, `text-*`, `border-*`, `outline-*`, `fill-*` y `stroke-*` cuando aparece en el código.

| Token | Uso |
| --- | --- |
| `paper`, `surface`, `surface-2` | Página, tarjetas/controles y fondos suaves |
| `ink`, `ink-2`, `ink-3` | Texto principal, secundario y de apoyo |
| `accent` / `accent-ink` | Relleno amarillo y texto sobre ese relleno |
| `accent-text`, `accent-soft` | Enlaces/foco y fondo suave de acento |
| `line` | Separadores decorativos; nunca borde funcional único |
| `border` | Límites de controles |
| `on-ink`, `on-ink-2`, `on-ink-3`, `on-ink-accent` | Texto sobre `bg-ink`, incluidas superficies de marca |
| `ok`, `warn`, `off`, `crit` y sufijos `-soft` | Éxito, advertencia, agotado y error con texto explícito |
| `packshot`, `packshot-ink`, `packshot-ink-2`, `packshot-ink-3`, `packshot-off`, `packshot-line`, `packshot-accent` | Fotografía/arte sobre blanco constante entre temas |

Amarillo no se usa como texto sobre superficies claras. Iconos usan `currentColor`; no incluir hex en componentes. No combinar cualquier texto/fondo arbitrariamente: las parejas aprobadas están en `scripts/check-contrast.mjs`.

## Equivalencias de la maqueta

- `font-display`: Big Shoulders Display 700; `font-sans`: IBM Plex Sans 400/600; `font-mono`: IBM Plex Mono 400/600. Fuentes Fontsource 5.3.0 alojadas localmente, sin depender de Google Fonts en ejecución.
- Escala original: `text-display-xl`, `text-display-l`, `text-display-m`, `text-body-l`, `text-body-m`, `text-body-s`, `text-label`, `text-data-l`, `text-data-s`.
- Datos: `font-mono tabular-nums`. Espaciado base 4 px: `p-4` = 16 px, `gap-6` = 24 px. Evitar valores fraccionarios cuando se migre la rejilla.
- `rounded-sm` = 2 px; `rounded-pill` reservado a chips. `max-w-store` = 1180 px, `max-w-nav` = 1320 px.
- `sm`, `md`, `lg` corresponden a 480/768/1100 px. Gutter de referencia: `px-4 md:px-8`.
- Preflight reemplaza el reset antiguo. No importar el CSS original en la aplicación: contiene reglas globales y selector `:has(#theme-switch)` incompatibles con el nuevo contrato de temas. Formularios, botones y tablas tienen estilos explícitos en la muestra.

## Contraste y ajustes

`npm run check:contrast` mide luminancia sRGB y razones WCAG sin redondear antes de comparar. Verifica 44 parejas por tema: texto normal >=4.5:1; bordes/foco >=3:1. Foco global de 2 px con separación de 3 px. Texto y símbolos acompañan los estados; no depender únicamente del color.

Se conservaron los colores principales del PDF. Para permitir texto normal también sobre fondos suaves y cumplir contraste de controles, se corrigieron estos complementos del CSS original:

- `ink-3` claro y `packshot-ink-3`: de #797EA0 a #5B6079.
- `ink-3` y `off` oscuros: de #868BAD / #9297BC a #A6ABC9.
- `border` oscuro: de #5C6291 a #858BB5.
- `on-ink-3`: se iguala a `on-ink-2` (#B6BBDA claro, #4A5078 oscuro), para mantener contraste incluso sobre superficies suaves invertidas.

Los hex de esta sección son registro histórico; los componentes obtienen todos los valores de la fuente central. Packshot sigue blanco en ambos temas.

## Demostración y adopción

`/` usa tokens semánticos y tipografía. `/sistema-visual` demuestra superficies, botón primario/secundario/deshabilitado, campo de búsqueda, selector, estados, tabla con cifras tabulares y pie sobre tinta en ambos temas. Es una referencia visual, no un catálogo ni un flujo comercial.

Cabecera, pie comercial, tarjetas, filtros, detalle, carrito, cuenta, checkout y administración todavía no existen: los issues que los implementen deben usar este contrato. #22 añade persistencia; #29 verifica navegación por teclado y contraste en contextos reales. El checkout alojado de Stripe se configura mediante las opciones de marca de Stripe, no con Tailwind local.

## Verificación realizada

- `npm run check:contrast`: 44 parejas por tema, todas dentro del mínimo aplicable (88 verificaciones). El mínimo de controles fue 3.16:1 en claro y 4.44:1 en oscuro; ningún texto normal probado baja de 4.5:1.
- `npm run build`: correcto, con fuentes WOFF2 incorporadas a la salida local.
- Servidor compilado: `/` y `/sistema-visual` respondieron HTTP 200 con el contenido esperado.
- `git diff --check`: correcto. El CSS original se preservó sin importarlo en la aplicación.

Estas verificaciones cubren tokens, compilación y respuesta SSR. La inspección visual del selector y el recorrido de teclado en navegador quedan para la revisión UX; no se presentan como pruebas ya ejecutadas. Sobre `bg-ink`, usar `focus-visible:outline-on-ink-accent` para adaptar el foco al fondo invertido; el foco global está aprobado para paper/surface/surface-2.
