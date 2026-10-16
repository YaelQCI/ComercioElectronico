# CI/CD con GitHub Actions y EC2

El flujo `.github/workflows/ci-cd.yml` está preparado para actualizar una instancia **Linux x86_64** mediante SSH. Todavía no se creó una instancia ni se configuraron credenciales en GitHub. No se realizó push ni despliegue externo.

## Flujo

1. Un pull request o push a `main` ejecuta pruebas unitarias y PostgreSQL en Docker aislado, verifica scripts, catálogo e imágenes y compila Nuxt.
2. Con la variable del repositorio `EC2_DEPLOY_ENABLED=true`, un push a `main` que pasó las pruebas publica aplicación y herramientas en GHCR. Las imágenes llevan el commit y se despliegan por digest SHA-256.
3. El job del environment `production` transfiere por SSH Compose y scripts. Los secretos de la aplicación permanecen en el servidor; no se hace `git pull` allí.
4. EC2 descarga las imágenes, comprueba PostgreSQL, crea y valida un respaldo lógico, aplica `prisma migrate deploy`, actualiza la aplicación y comprueba `/api/health` por HTTPS antes de registrar el éxito.

GitHub serializa despliegues y el servidor utiliza un bloqueo adicional. No se cancelan ejecuciones a mitad de una migración. PostgreSQL usa el volumen `fitness-stuff-ec2-postgres` y las cargas `fitness-stuff-ec2-uploads`, separados del entorno local. Hay una interrupción breve al recrear aplicación/proxy; no es una actualización sin downtime.

## Preparar EC2 una vez

Elegir Linux **x86_64**, por ejemplo Ubuntu. Instalar Docker Engine, Docker Compose v2 con soporte de `--wait`, OpenSSL, curl, tar y flock. Habilitar Docker al arrancar y dar acceso al usuario de despliegue sin `sudo`; ese acceso implica privilegios administrativos sobre el host. [Instalación oficial de Docker](https://docs.docker.com/engine/install/ubuntu/).

Permitir 80/443 en el security group y habilitar SSH por una vía controlada para el administrador y el runner. El runner necesita alcanzar el puerto 22. Los runners hospedados de GitHub no tienen IP fija: utilizar acceso de red/allowlist administrado o un runner con conectividad privada. Una regla que permite solo la IP de tu computadora no permite automáticamente GitHub Actions. No publicar PostgreSQL ni 3001. [Reglas de EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).

Con los archivos del repositorio disponibles inicialmente en el servidor:

```bash
sudo install -d -o "$USER" -g "$(id -gn)" -m 700 /opt/fitness-stuff
bash deploy/prepare-server.sh TU_IP_PUBLICA
```

Se generan claves aleatorias en `/opt/fitness-stuff/shared/.env` y un certificado autofirmado para la IP. Repetir conserva los valores. Completar privadamente contacto, Envia y Stripe según `deploy/.env.example`. No ejecutar el `.env` como código ni versionarlo. Mantener la contraseña hexadecimal generada para no introducir caracteres que requieran escapes en la URL PostgreSQL.

`PUBLIC_HOST` es la IP o nombre público sin protocolo, comillas, puerto o ruta. Si cambia la IP, actualizarlo y reemplazar el certificado por uno para el nuevo host. No regenerar contraseña de base o clave de sesión en cada release.

El workflow publica con su `GITHUB_TOKEN` temporal y permiso `packages: write`. Para descargar las im?genes, env?a el token del job de despliegue (`packages: read`) por la entrada est?ndar de SSH a Docker; utiliza una carpeta privada por ejecuci?n y la elimina al terminar. No requiere un PAT permanente en EC2. Vincular los paquetes GHCR al repositorio y comprobar sus permisos. [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Activar en GitHub

Crear el environment **production**, limitarlo a `main` y registrar sus secretos:

| Secreto | Contenido |
| --- | --- |
| `EC2_HOST` | IP o nombre público de la instancia |
| `EC2_USER` | Usuario SSH, por ejemplo `ubuntu` |
| `EC2_SSH_KEY` | Clave privada dedicada, sin contraseña interactiva |
| `EC2_KNOWN_HOSTS` | Línea de host SSH verificada para esa instancia |

Agregar la clave pública al `authorized_keys` del usuario. Verificar la huella del host mediante una sesión confiable/SSM/consola de AWS antes de guardar su clave en known_hosts. Una recolección ciega de la clave no verifica su identidad. El workflow usa `StrictHostKeyChecking=yes`.

En Settings → Secrets and variables → Actions → Variables, crear la variable **del repositorio** `EC2_DEPLOY_ENABLED=true` al terminar la preparación. Sin ella, CI funciona y se omite publicar/desplegar. Configurar en el environment las variables `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN` y `EC2_SECURITY_GROUP_ID`. El rol conf?a exclusivamente en el subject OIDC de este repositorio y environment; no hay claves AWS permanentes en GitHub. El formato del subject puede incluir IDs inmutables: consultar la configuraci?n OIDC del repositorio antes de definir la confianza.

Un push a `main` activa el flujo. También permite Actions → Validar y desplegar en EC2 → Run workflow sobre `main`. Los pull requests no publican ni reciben secretos de despliegue. Las revisiones del environment y protección de rama son opciones del propietario, no se configuraron automáticamente. [Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Sin dominio

Abrir `https://TU_IP_PUBLICA`. El certificado autofirmado mostrará un aviso de confianza en el navegador: verificarlo y configurar su confianza en los equipos de demostración. Para acceso público, sustituir `shared/tls/fullchain.pem` y `privkey.pem` por un certificado confiable y reiniciar el proxy. Nginx redirige HTTP a HTTPS.

La aplicación marca sus cookies como `Secure` en producción: HTTP sobre una IP pública no basta para conservar sesiones/carritos. No se deshabilitaron estas protecciones. El webhook de Stripe necesita HTTPS públicamente validable; el certificado autofirmado no completa esa configuración. Mantener pagos deshabilitados hasta configurar HTTPS confiable o un túnel HTTPS para pruebas y su webhook. Con `NUXT_STRIPE_ENABLED=true`, el despliegue mantiene el reconciliador; de lo contrario lo detiene. No se activa live ni se hacen cobros.

## Recuperación y respaldos

Si falla la migración, no se recrea la aplicación. Si falla la nueva aplicación o su salud, el job termina en error y no se marca el commit como completado; puede requerir intervención para restaurar servicio. No hay rollback automático de esquema. Diseñar migraciones compatibles con la versión anterior, separando adición y retiro de columnas/contratos.

`current-commit` indica el último despliegue completado; `current`, `previous-release` y `releases/<commit>` conservan referencias de versiones. Antes de volver a una imagen anterior hay que comprobar su compatibilidad con el esquema actual.

Los respaldos quedan en `shared/backups/*.dump`; `.partial` identifica un respaldo incompleto. Programar copia fuera de la instancia, retención y pruebas de restauración. También respaldar el volumen de cargas: el dump no contiene fotografías ni certificados. No restaurar automáticamente un dump porque puede perder ventas posteriores. El despliegue no ejecuta `migrate reset`, `down -v` ni limpieza de volúmenes.

Una base nueva incorpora los datos DEMO de las migraciones existentes. Las cuentas reales, base local y fotos cargadas no se trasladan automáticamente. Configurar el primer almacén y crear/asignar el administrador con los procedimientos existentes.

## Verificación y límites

`scripts/check-deployment.sh` simula Docker/red para comprobar respaldo antes de migrar, fallos bloqueados, marcadores de éxito, reconciliador y preparación repetida sin sobrescribir secretos. `check-ec2-compose.sh` levanta un stack efímero con volúmenes propios y comprueba migración, HTTPS y sesiones mediante `check-deployment-https.mjs`; al terminar elimina únicamente ese stack de prueba.

Verificado localmente: actionlint/shellcheck, sintaxis Bash/Compose, protocolo simulado y stack efímero con las diez migraciones, Nginx saludable, certificado verificado, registro, login, sesión Secure y rechazo de un origen diferente. Se conservaron intactos los contenedores y volúmenes de la tienda. La ejecución real en GitHub y EC2 queda pendiente de instancia, secretos y primer push autorizado; esta evidencia local no equivale a un despliegue externo.

## Instancia temporal de esta demostraci?n

- URL: `https://52.37.189.103`, certificado autofirmado.
- Cuenta actual: `086241318012`, usuario IAM `admin-yael`, perfil local `default`.
- EC2: `i-0307c6afd99306957`, `t3.small`, 2 GB de RAM y 2 GB de swap, Oregon. El plan gratuito de la cuenta no permiti? `t3.medium`; no se cambi? el plan.
- Disco gp3 cifrado de 30 GB e IP el?stica. Los cr?ditos de CPU est?n en modo standard.
- Apagado programado: **23 de octubre de 2026, 15:56 UTC** (09:56 de Ciudad de M?xico), mediante `fitness-demo-stop.timer`. Conserva datos e IP. Para usarla despu?s, hay que extender o deshabilitar ese temporizador.
- Estado y acceso privado en `.aws/`, ignorado por Git y Docker. No compartir esa carpeta ni la clave SSH.

Desde PowerShell, con AWS CLI autenticado:

```powershell
./deploy/manage-demo-instance.ps1 status
./deploy/manage-demo-instance.ps1 stop
./deploy/manage-demo-instance.ps1 start
```

Apagar detiene el c?mputo, pero disco e IP reservada siguen generando cargos. La terminaci?n est? protegida; no se programa eliminar la instancia ni los datos. La gu?a de operaci?n no sustituye revisar el consumo en AWS.

### Evidencia del primer despliegue manual

El 16 de octubre se compil? en EC2 el commit `2090fb0fa14740236b3f8e18cc9f306796999384` con Node 24, se respald? PostgreSQL antes de aplicar las diez migraciones y quedaron saludables aplicaci?n, base y proxy. Se verificaron desde fuera de EC2 el certificado HTTPS por su CA, registro, login ADMIN, sesi?n con cookies Secure y respuestas HTTP 200 de inicio, cat?logo y administraci?n. Esto verifica servidor y autenticaci?n; no es una revisi?n visual o de interacci?n en navegador.

La base contiene 28 productos DEMO, 48 lotes (incluidos hist?ricos), 12 pedidos ficticios y 8 rese?as. Se traslad? el almac?n autorizado y el token de Envia se guard? por SSH en la configuraci?n privada; no se valid? todav?a una cotizaci?n completa desde el navegador. Stripe permanece deshabilitado. La imagen final no contiene `simple-git` ni `@simple-git/argv-parser`, dependencias de herramientas se?aladas por la auditor?a de instalaci?n.

La validaci?n final de actionlint, sintaxis Bash y pruebas simuladas de despliegue pas? en EC2. El primer despliegue utiliz? im?genes compiladas localmente en la instancia; el flujo autom?tico usar? im?genes GHCR por digest. Todav?a falta ejecutar ese flujo en GitHub tras el push autorizado.

### Traslado de cuenta AWS

El despliegue se traslad? a la cuenta `086241318012` por indicaci?n del propietario. Se preserv? un respaldo privado de PostgreSQL y archivos en `.aws/migration-backup/`, se restauraron los datos en un volumen nuevo y se regeneraron los secretos de infraestructura y el certificado para la IP nueva. Las credenciales del administrador DEMO se conservan. El apagado mantiene su plazo original del 23 de octubre. El script de gesti?n valida el ID de cuenta antes de iniciar, detener o consultar la instancia y admite el perfil indicado en el estado privado.

La limpieza de la cuenta anterior `893679488502` se complet? mediante el perfil `origen`: instancia terminada y disco, IP el?stica, grupo de seguridad, par de claves, rol de despliegue y proveedor OIDC eliminados. Se comprob? que el proveedor no tuviera otros roles dependientes antes de retirarlo. Se conservaron VPC/subredes predeterminadas y los recursos ajenos al despliegue, as? como el respaldo local privado.

Validado el destino: HTTPS con certificado verificado, login del administrador conservado, sesi?n ADMIN y respuestas 200 en inicio, cat?logo y administraci?n. Los conteos restaurados coinciden: 28 productos, 48 lotes, 12 pedidos y 8 rese?as. Se actualizaron los secretos SSH y las variables de rol/grupo de seguridad del environment `production` de GitHub. Actions contin?a pendiente del push autorizado. El origen se apag? y posteriormente se termin?; se verific? la eliminaci?n de su disco, IP y configuraci?n IAM el 16 de octubre. La comprobaci?n HTTPS del destino volvi? a pasar despu?s de la limpieza.
