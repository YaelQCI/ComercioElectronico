# Staging y producción en la misma EC2

La instancia `i-0307c6afd99306957`, cuenta `086241318012`, conserva la IP `52.37.189.103`. No se creó otra instancia ni se aumentó su tamaño. Ambos entornos comparten CPU, memoria y disco físico; sus contenedores, redes, PostgreSQL, volúmenes, claves de sesión, usuarios y archivos de aplicación son independientes. Se mantiene el apagado temporal del 23 de octubre de 2026.

| Recurso | Staging | Producción |
|---|---|---|
| Rama y environment de Actions | `staging` | `main` / `production` |
| Directorio | `/opt/fitness-stuff` | `/opt/fitness-stuff-production` |
| Aplicación, acceso interno | `127.0.0.1:3001` | `127.0.0.1:3002` |
| Proyecto Compose | `fitness-stuff-ec2` | `fitness-stuff-production` |
| PostgreSQL | `fitness-stuff-ec2-postgres` | `fitness-stuff-production-postgres` |
| Cargas de imágenes | `fitness-stuff-ec2-uploads` | `fitness-stuff-production-uploads` |
| Stripe | `test`, habilitado, listener interno | `live`, deshabilitado hasta recibir credenciales |
| Datos iniciales | Se conservan datos de demostración | Sin pedidos, stock ni clientes de staging; productos DEMO sin publicar |

Cada base tiene su propia contraseña aleatoria. El administrador inicial de producción tiene credenciales independientes en `.aws/production-admin-credentials.json`, archivo local privado ignorado por Git. No se copiaron las sesiones de staging. Ambos entornos requieren revisar sus políticas, configurar los datos comerciales y el almacén antes de completar compras; producción tampoco tiene configurado un token real de Envia.

Las seis cuentas académicas que insertan las migraciones quedan desactivadas en producción, identificadas por sus correos exactos, hash DEMO, rol y auditoría de origen. Se conservan los registros y se audita su desactivación; no se tocan usuarios reales ni administradores.

## Despliegues

El workflow valida ambas ramas, publica imágenes del commit y elige un único directorio según la rama. Los PR no despliegan. Los environments restringen las ramas y OIDC acepta exclusivamente los subjects `production` y `staging` del repositorio. Cada entorno conserva su propio bloqueo, respaldo previo a migraciones y marcador `current-commit`.

Staging rechaza una configuración Stripe distinta de `test`. Producción exige `live` y datos DEMO deshabilitados; para habilitar pagos también exige una clave `sk_live_…`. La aplicación evita generar stock e historial académicos al configurar el almacén con `NUXT_DEMO_DATA_ENABLED=false`. Tras migrar producción se retiran de publicación solamente los productos de la marca/slug DEMO, con auditoría, sin eliminar registros ni modificar migraciones aplicadas.

El proxy compartido usa los puertos 80/443 y envía peticiones por loopback; los despliegues de una aplicación no recrean el proxy de la otra. PostgreSQL y los puertos de aplicación no se publican a Internet. Hasta recibir los dominios, la IP pública sigue mostrando staging y producción solo está disponible dentro del servidor.

## Asociar los dominios cuando estén disponibles

El propietario del DNS crea registros A hacia `52.37.189.103` para `fitnesstuf` y `stagging.fitnesstuf`. No crear AAAA mientras el servidor no tenga IPv6. Pasar los nombres completos, por ejemplo los siguientes nombres ilustrativos, al comando instalado en EC2:

```bash
bash /opt/fitness-stuff-gateway/configure-domains.sh fitnesstuf.ejemplo.com stagging.fitnesstuf.ejemplo.com
```

El comando comprueba que ambos registros A resuelvan exclusivamente a esta IP, solicita un certificado conjunto de Let's Encrypt mediante HTTP-01, valida Nginx, asocia los hosts a sus aplicaciones y actualiza las URLs de retorno de Stripe sin tocar sus claves. El challenge se sirve desde un webroot compartido, sin detener aplicaciones. Se configura la renovación automática y la recarga del certificado en Nginx.

La operación con dominios reales y la emisión del certificado están pendientes de recibir los nombres y de que el DNS esté propagado. No se necesita acceso a la cuenta AWS del propietario del dominio. El script no registra webhooks públicos de Stripe ni activa cobros: staging conserva su listener interno; producción necesita después su clave live y su secreto de webhook propios. Ninguna URL puede sustituir esas credenciales.

## Operación

`deploy/prepare-two-environments.sh` respalda staging, crea producción y prepara el gateway con recuperación al proxy anterior si el nuevo no arranca. No elimina volúmenes. `deploy/render-gateway.py` valida los nombres antes de escribir Nginx. El certificado por IP previo se mantiene separado del futuro certificado del dominio.

La separación de datos no proporciona alta disponibilidad: una detención o fallo de esta EC2 afecta a ambos entornos. Los respaldos del despliegue permanecen en el mismo disco; una estrategia externa de respaldos y restauración sigue pendiente para una operación permanente.

## Verificación inicial

Ambas aplicaciones y ambas bases arrancaron. Se comprobó login independiente con cada administrador, rechazo de cookies cruzadas, contraseñas de base/claves de sesión diferentes y catálogo público separado: 28 productos en staging y ninguno de demostración publicado en producción. Producción conservó cero pedidos, stock y clientes de staging. El proxy se probó con dos dominios `.invalid`, certificados efímeros verificados y puertos de loopback: cada host llegó al catálogo correcto sin cambiar DNS. `scripts/check-shared-gateway.sh` reproduce esa comprobación sobre el estado inicial.

Las pruebas simuladas de despliegue verifican además que producción rechaza Stripe test antes de migrar y que los despliegues compartidos no recrean el proxy. El caso de uso de configuración del almacén se probó con DEMO habilitado/deshabilitado. La emisión real de certificados y la renovación con el dominio prestado todavía no se pueden comprobar hasta recibirlo.
