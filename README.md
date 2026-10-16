# The Fitness Stuff · ComercioElectronico

La [entrega técnica y evidencia por parcial](docs/technical-delivery.md) reúne los módulos implementados, pruebas y pendientes actuales. El [modelo físico](docs/modelo-base-de-datos.md) y las [decisiones](docs/decisiones-base-de-datos.md) enlazan esquema y migraciones; los apartados iniciales siguientes conservan contexto histórico de la base.

El [estado de implementación por issue](docs/implementation-status.md) registra la auditoría del 14 de octubre, cierres verificados y criterios pendientes.

Base de implementación del [issue #43](https://github.com/YaelQCI/ComercioElectronico/issues/43).

## Requisitos y versiones

- Node.js **24.12.0** (rama 24), npm incluido con Node; `.nvmrc` registra el runtime.
- Nuxt **4.5.2**, Vue **3.5.44**, Tailwind CSS y plugin Vite **4.3.3**.
- Prisma Client/CLI/adaptador PostgreSQL **7.10.0**, pg **8.23.1**.
- PostgreSQL **17.7**, Docker Compose v2 para la base local.

Se consultaron versiones y `engines` en npm antes de fijarlas: Nuxt 4.5.2 y Prisma 7.10.0 admiten Node 24.12. No se eligió el tag de Prisma que devolvía una versión candidata. Las dependencias directas y el lockfile fijan la instalación.

Aplicación y scripts en JavaScript. `prisma.config.ts` y el cliente generado en `generated/prisma` son auxiliares TypeScript de Prisma 7; Node 24 ejecuta el script de diagnóstico mediante su soporte de eliminación de tipos. El cliente generado no se versiona. Integración basada en la [guía oficial Prisma/Nuxt](https://docs.prisma.io/docs/guides/frameworks/nuxt).

## Instalación local

Para ejecutar aplicación y PostgreSQL juntos sin usar la base habitual, seguir [Docker local](docs/docker-local.md). Publica la tienda en http://localhost:3001 y dispone de pruebas en PostgreSQL17.7 aislado.

Desde un clon limpio, en PowerShell:

```powershell
Copy-Item .env.example .env
npm.cmd ci
docker compose up -d --wait postgres
npm.cmd run db:check
npm.cmd run dev
```

En otras terminales usar `npm` en lugar de `npm.cmd`. El sufijo evita la restricción de ejecución de npm.ps1 de Windows sin cambiar políticas del sistema. Abrir http://localhost:3000 y http://localhost:3000/api/health.

La página puede arrancar sin base. `/api/health` devuelve `{"status":"ok"}` cuando PostgreSQL responde y 503 con mensaje genérico si falla, sin publicar URL, credenciales ni detalles del proveedor. No comprueba aún tablas de negocio.

`.env.example` contiene credenciales **solo para desarrollo local**. Modificarlas antes de usar servicios compartidos. Nunca subir `.env`. `DATABASE_URL` se lee exclusivamente en servidor/scripts; las claves secretas Stripe son privadas y únicamente la clave publicable tiene prefijo `NUXT_PUBLIC_`. Stripe no es necesario para arrancar.

Sin Docker: instalar PostgreSQL 17.7, crear una base y un usuario con permisos sobre ella, y configurar `DATABASE_URL`. Mantener los datos `POSTGRES_*` coherentes con la URL cuando se use Compose. No se depende de AWS.

## Estructura

La [propuesta de negocio de #31](docs/business-proposal.md) define oferta, público, modelo B2C, recorrido del cliente y estrategia comercial, distinguiendo las capacidades actuales de los servicios pendientes.

La [arquitectura y contratos de #32](docs/architecture.md) describen responsabilidades por dominio, flujos, modelo relacional, configuración por entorno y capacidades pendientes.

| Ruta | Uso |
| --- | --- |
| `app/pages`, `app/components` | Rutas Vue y componentes compartidos |
| `app/assets/css/main.css`, `tokens.css` | Entrada Tailwind, tipografías y colores semánticos claro/oscuro |
| `public/images` | Imágenes servidas estáticamente |
| `references` | Prototipo original y fuentes sin reemplazarlos |
| `server/api`, `server/utils` | API Nuxt y singleton Prisma con pool limitado |
| `prisma/schema.prisma`, `prisma/migrations` | Modelo y migraciones versionadas |
| `scripts` | Diagnóstico y semilla |

Este checkout solo contenía README.md: los HTML/CSS/images mencionados en los issues no estaban disponibles. No se inventó catálogo ni se sustituyeron originales.

## Modelo y migraciones (#33)

El esquema y la primera migración integral de [#33](https://github.com/YaelQCI/ComercioElectronico/issues/33) están preparados: 57 tablas con restricciones PostgreSQL y pruebas de integración. Procedimiento y alcance en [docs/database-migrations.md](docs/database-migrations.md). Las migraciones posteriores incluyen categorías, cajas de referencia, políticas en borrador y [28 artículos de demostración publicados con imágenes locales](docs/catalogo-demostracion.md). `db:seed` no duplica estos datos. Generar cliente o arrancar la aplicación fuera de Docker no migra automáticamente la base; Docker usa el servicio `migrate`.

Para aplicar la migración inicial en una base propia vacía: `npm run db:deploy`. Para cambios posteriores:

1. Editar `prisma/schema.prisma` según #33 y ejecutar `npm run db:validate` y `npm run db:generate`.
2. En una base de desarrollo aislada: `npm run db:migration:create -- --name nombre_del_cambio`.
3. Revisar el SQL y agregar CHECK, índices parciales y restricciones de pertenencia que Prisma no represente. Revisar antes de aplicar.
4. Aplicar migraciones existentes con `npm run db:deploy`; para desarrollar cambios de esquema usa `npm run db:migrate`. El catálogo de demostración se instala desde migraciones y no requiere un seed adicional. Almacén, existencias y datos comerciales se registran explícitamente desde Administración.
5. Versionar esquema y SQL en el mismo cambio; validar lectura/escritura sobre una entidad real y escenarios de #33.
6. En despliegue: respaldar la base, ejecutar `npm run db:deploy` y luego arrancar el build. No usar `migrate dev`, `db push` ni resets en producción. No reescribir migraciones aplicadas.

## Build y persistencia

La [integración de Stripe #30](docs/stripe-payments.md) conecta Checkout alojado, reservas, webhooks, reconciliación y reembolsos autorizados. Permanece deshabilitada por defecto; las pruebas usan dobles de proveedor, sin cobros reales. Consultar configuración, comandos de recuperación y criterios pendientes antes de habilitarla.

```powershell
npm.cmd run db:validate
npm.cmd run build
npm.cmd run start
```

`npm ci` genera cliente y prepara Nuxt. `npm run start` sirve el build en puerto 3000. El volumen `postgres_data` conserva datos con `docker compose restart postgres` y `docker compose down`; `down -v` elimina los datos y no forma parte del procedimiento normal.

Las pruebas de #33 usan una base exclusiva y fixtures sintéticas: `TEST_DATABASE_URL` debe apuntar a `fitness_migration_test*`, luego ejecutar `npm run test:database`. La integración comercial desde API y la comprobación del volumen Docker siguen pendientes; la evidencia de la prueba aislada está en docs/database-migrations.md.

## Diagnóstico

- Docker no conecta: iniciar Docker Desktop y verificar `docker info`; luego `docker compose up -d --wait postgres`.
- Puerto ocupado: cambiar el puerto publicado en Compose y el puerto de `DATABASE_URL` juntos.
- Credenciales rechazadas: revisar URL/usuario/base. Cambiar variables de Compose no modifica automáticamente usuarios de un volumen ya inicializado; ajustar el rol dentro de PostgreSQL, sin borrar el volumen.
- Cliente ausente: ejecutar `npm run db:generate`.
- Error de conexión: ejecutar `npm run db:check`, comprobar host/puerto y disponibilidad. El diagnóstico evita imprimir secretos.
- Migraciones pendientes: aplicar el SQL revisado con `npm run db:deploy` en base propia vacía; no modificar migraciones aplicadas ni usar resets para corregir un entorno compartido.

## Alcance pendiente para aceptar #43

La migración integral y lectura/escritura Prisma ya se validaron en PostgreSQL aislado. La semilla comercial, servicios autorizados y validación del entorno PostgreSQL 17.7/Docker siguen coordinándose con #33. #41 cubre AWS/Route 53. Esta base no integra cobros ni recursos cloud.

Los tokens de #42 están documentados en [docs/design-tokens.md](docs/design-tokens.md). Abrir `/sistema-visual` para probar ambos temas y ejecutar `npm run check:contrast` para medir sus parejas de colores. La [preferencia persistente de #22](docs/theme-preference.md) está disponible en Mi cuenta → Apariencia y se guarda por usuario en PostgreSQL.

La evidencia y los avisos pendientes de dependencias están en [docs/validation.md](docs/validation.md). En este equipo responde un servicio PostgreSQL en el puerto 5432 que rechaza las credenciales de ejemplo; Docker no está iniciado. Configurar una base propia o un puerto libre antes de validar persistencia.
