# Probar el proyecto con Docker

Requiere Docker Desktop en modo contenedores Linux y Docker Compose v2. No necesitas Node/PostgreSQL instalados para construir y ejecutar; el comando inicial de credenciales sí usa Node local (alternativamente crear .env.docker privado con los nombres DOCKER_POSTGRES_PASSWORD, DOCKER_AUTH_SECRET y DOCKER_APP_PORT, secretos aleatorios largos y puerto3001). En Windows abrir Docker Desktop y esperar a que `docker info` responda.

Desde la raíz del repositorio:

```powershell
node scripts/prepare-docker-env.mjs
docker compose --env-file .env.docker -f compose.docker.yaml up -d --build app
docker compose --env-file .env.docker -f compose.docker.yaml ps
```

Abrir http://localhost:3001 y http://localhost:3001/api/health. El servicio migrate aplica migraciones versionadas mediante Prisma deploy, después de PostgreSQL saludable; app requiere finalización exitosa de migrate. [Orden de arranque de Compose](https://docs.docker.com/compose/how-tos/startup-order/) documenta ambas condiciones. Si falla migración no se inicia aplicación. Nunca se hace reset ni seed comercial automático.

El archivo compose.docker.yaml es independiente de compose.yaml y usa proyecto fitness-stuff-local: no modifica PostgreSQL del equipo, .env habitual ni el volumen del Compose anterior. Base fitness_docker persistente, sin puerto PostgreSQL expuesto; solo app se publica en loopback. .env.docker contiene secretos locales aleatorios, excluidos de Git y contexto Docker. No regenerar credenciales sobre un volumen ya creado; el preparador conserva archivo existente. Cambiar DOCKER_APP_PORT si3001 está ocupado.

## Pruebas automáticas aisladas

```powershell
docker compose --env-file .env.docker -f compose.docker.yaml --profile tests run --build --rm tests
```

Levanta test-postgres con PostgreSQL17.7 y base fitness_migration_test_docker en tmpfs. Aplica migraciones, crea explícitamente almacén sintético necesario para fixtures y ejecuta pruebas unitarias y PostgreSQL. No toca fitness_docker. Las fixtures crean productos/pedidos/políticas sintéticos únicamente en base de pruebas, sin cobros ni correos. Se pueden volver a ejecutar; para desechar esa base temporal detener/eliminar únicamente test-postgres:

```powershell
docker compose --env-file .env.docker -f compose.docker.yaml --profile tests stop test-postgres
docker compose --env-file .env.docker -f compose.docker.yaml --profile tests rm -f test-postgres
```

## Cambios, diagnóstico y persistencia

```powershell
docker compose --env-file .env.docker -f compose.docker.yaml logs --tail 50 app migrate
docker compose --env-file .env.docker -f compose.docker.yaml up -d --build app
docker compose --env-file .env.docker -f compose.docker.yaml restart postgres app
docker compose --env-file .env.docker -f compose.docker.yaml down
```

El segundo comando recompila tras cambios: no hay montaje del código ni hot reload. down detiene contenedores y conserva volumen de la base de aplicación; volver a up recupera datos. No usar down -v: eliminaría los datos de este entorno. No publicar logs/config completos sin revisar secrets/PII.

La imagen tools incluye dependencias y scripts para migraciones/pruebas; runtime contiene únicamente salida compilada y ejecuta como usuario node sin root. No copia .env, datos locales, node_modules del host ni Git. Contenedores son de prueba local, no despliegue comercial final: roles DB/HTTPS/backup/colas se gestionan en #36/#41.

Verificado el 14 de octubre de 2026 con Docker Desktop29.0.1: construcción Linux con Node24.12, tres migraciones aplicadas, app/PostgreSQL saludables, HTTP200 en salud/inicio/catálogo/cuenta/carrito, 56 pruebas unitarias y 73 PostgreSQL17.7 exitosas. Persistencia de registro sintético comprobada tras reiniciar ambos contenedores; registro retirado después. Base temporal de tests detenida/eliminada sin tocar volumen de aplicación. El adaptador pg emite aviso de deprecación ya conocido; todas las pruebas pasan con la versión fijada. Esto no representa prueba visual ni sandbox/venta real.

## Qué podrás probar

Navegación, tema, estados vacíos, registro/login/perfil y API con base persistente. La base de aplicación arranca sin catálogo ni políticas comerciales: no inventamos diez productos reales ni habilitamos checkout comercial. Las pruebas automáticas sí ejercitan catálogo/carrito/pedidos/pagos simulados con fixtures aisladas. Para recorrido visual de compra hacen falta catálogo/almacén/cajas/políticas documentados, importación autorizada y configuración Envia/Stripe sandbox; este Compose mantiene Stripe deshabilitado y no importa secretos del .env habitual.
