# Reglas del proyecto

Este archivo define las reglas para trabajar en este repositorio. Su alcance es todo el proyecto. Se actualizará conforme el propietario indique nuevas reglas.

## Arquitectura: Screaming Architecture

- La estructura del código debe expresar el negocio de The Fitness Stuff. Organizar las funcionalidades por capacidades del dominio, como catálogo, carrito, pedidos, inventario y pagos, en lugar de agrupar toda la lógica únicamente por categorías técnicas.
- Para funcionalidad nueva, usar módulos de negocio en `app/features/<dominio>/` para la interfaz y en `server/features/<dominio>/` para los casos de uso del servidor. Crear solamente las carpetas y capas que la funcionalidad necesite.
- Mantener `app/pages/` y `server/api/` como puntos de entrada de Nuxt: componen la interfaz o reciben la petición y delegan al módulo correspondiente. No concentrar reglas de negocio en páginas, componentes visuales o handlers HTTP.
- Los casos de uso coordinan las operaciones del negocio. Las reglas de dominio no deben depender de Vue, Nuxt, HTTP ni Prisma; pasar los datos y dependencias necesarios explícitamente.
- Encapsular el acceso a Prisma y las integraciones externas dentro del módulo que los utiliza. No acceder a la base de datos desde el navegador. Los cambios que afecten varias entidades deben respetar sus invariantes y límites transaccionales.
- Compartir únicamente piezas utilizadas por varios dominios: componentes visuales en `app/components/`, layouts en `app/layouts/` e infraestructura común del servidor en `server/utils/`. No convertir estas carpetas en depósitos de lógica de negocio.
- Usar nombres que describan la capacidad o intención del negocio. Evitar abstracciones genéricas y capas sin una necesidad concreta.
- La estructura existente contiene la base inicial del proyecto. Adaptarla al trabajar en cada funcionalidad; documentar desviaciones de estas reglas sin emprender reorganizaciones ajenas al cambio solicitado.

## Convenciones actuales

- Mantener Nuxt, Vue, Tailwind, Prisma y PostgreSQL como tecnologías del proyecto. Seguir el estilo de JavaScript y módulos ES existente; los archivos auxiliares de Prisma pueden usar TypeScript.
- Reutilizar los tokens de `app/assets/css/tokens.css` y las fuentes configuradas. Mantener navegación semántica, foco visible y controles accesibles.
- Mantener el texto de la aplicación y la comunicación sobre el trabajo en español.
- No inventar productos, datos de contacto, políticas ni registros comerciales definitivos. Distinguir los datos de prueba y los contenidos pendientes de los datos reales.
- Versionar los cambios de esquema mediante migraciones de Prisma. No modificar migraciones ya aplicadas ni ejecutar reinicios destructivos sobre bases existentes para resolver un cambio.
- No versionar secretos, archivos `.env`, datos locales de PostgreSQL ni artefactos generados. Documentar las variables necesarias en `.env.example` sin valores sensibles.

## Trabajo con issues y Git

- Implementar el alcance del issue y dejar explícitos los criterios completados y los pendientes. No afirmar que una funcionalidad está terminada si solo existe su estructura inicial.
- Antes de registrar una implementación, ejecutar las comprobaciones pertinentes al cambio y documentar sus resultados y limitaciones. No presentar una comprobación SSR como validación visual o de interacción en navegador.
- Cuando se solicite un commit, incluir únicamente los cambios correspondientes y referenciar el issue en el mensaje.
- Cuando se soliciten comentarios en GitHub, registrar qué se implementó, cómo se verificó, qué falta y el commit correspondiente. Cerrar el issue solo cuando sus criterios estén satisfechos o el propietario lo indique expresamente.
- Mantener los commits locales. No hacer push hasta que el propietario indique que se deben subir los cambios juntos.

## Nuevas reglas

Incorporar aquí las siguientes instrucciones del propietario, manteniendo consistencia con las reglas vigentes y actualizando las que él sustituya.
