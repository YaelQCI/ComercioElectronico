# Preparación AWS y Route 53 (#41)

14 de octubre de 2026. No existen recursos aprovisionados ni dominio adquirido. Región y servicios son propuestas para aprobación del propietario; presupuesto final requiere calculadora AWS y datos de carga. Nuxt necesita Node con API/webhook/sesiones activos: exportar HTML estático no satisface aplicación.

## Opciones y estimación

|Opción|Ventaja|Costo y límites|
|---|---|---|
|Lightsail VM Linux + PostgreSQL administrado Lightsail + Route53|VM admite Node, systemd y procesos reintentables; operación pequeña|Base indicativa VM2GB USD12 + DB2GB cifrada USD30 + zona USD0.50 = USD42.50/mes, más copias, DNS, dominio, impuestos y extras; instancia única sin alta disponibilidad|
|EC2 + RDS PostgreSQL + Route53|Red privada, roles y copias administradas más flexibles|Cotizar región/tipo/disco/IPv4/backups/transferencia; no presentar una cifra sin esos parámetros; mayor operación/costo variable|
|Contenedores administrados + RDS|Despliegues por imagen/escalado; worker separado|Más servicios y costo; imagen/roles/scheduler requeridos; comprobar SSR y compatibilidad runtime|

Propuesta para piloto académico: Lightsail Linux con PostgreSQL administrado cifrado, en us-east-1 si disponibilidad de engine/red/cuenta y latencia resultan adecuadas. No es selección aprobada. Evitar plan DB básico sin cifrado. No asumir compatibilidad PostgreSQL17.7 administrada: consultar versiones disponibles antes de crear recursos y repetir migraciones/test con la versión elegida. Para operación comercial evaluar HA/RDS y riesgo de nodo único.

Fuentes oficiales consultadas: [precios Lightsail](https://aws.amazon.com/lightsail/pricing/), [RDS PostgreSQL](https://aws.amazon.com/rds/postgresql/pricing/), [Route53](https://aws.amazon.com/route53/pricing/). Valores orientativos en USD sin promoción gratuita; confirmar región y presupuesto antes de gasto. Precio mensual de zona no incluye registro de dominio.

## Runtime, red y configuración

Node24.12 rama24 según .nvmrc, npm ci con lockfile, Prisma7.10 y Nuxt4.5.2. Build fuera de producción o en host de construcción compatible; entregar release con .output, generated Prisma, scripts y dependencias necesarias. Nunca hacer npm install flotante ni usar Nuxt generate para backend. Usuarios separados: migrador con DDL, aplicación con CRUD necesario/ledger sin privilegios administrativos, propietario de tablas/triggers distinto; verificar permisos en réplica aislada antes de restringir producción. TLS PostgreSQL con certificado validado; no desactivar verificación para resolver configuración.

Solo HTTPS443 público, 80 redirige para certificado; Node3000 en loopback tras proxy. PostgreSQL5432 privado, únicamente desde servidor/worker; SSH restringido a operadores, no universal. Crear usuario fitness sin privilegios, /opt/fitness/releases/version y enlace current, secrets en /etc/fitness/runtime.env accesible solo al servicio y operador; no Git, logs ni imagen. Separar cuentas/DB/dominio/config Stripe test/live; sesión/auth y claves webhook diferentes. No exponer secretos bajo NUXT_PUBLIC_. La base local/comercial existente no se migra durante preparación.

Plantillas revisables en deploy/: servicio web, reconciliación oneshot y timer cada minuto sin solapar la misma unidad, proxy ejemplo. Son Linux/systemd, no se han instalado ni probado en Windows/AWS. Confirmar /usr/bin/node y permisos reales. Activar timer solo después de aprobar entorno y conocer efectos de --apply (consulta/expira/reconcilia intentos existentes). Reconciliación procesa hasta20 por ejecución; monitorear atraso/fallos y ampliar cobertura antes de prometer SLA. Modo sin --apply solo cuenta pendientes.

## Publicación reproducible sin push automático

Tras autorización de subir commits juntos, fijar commit/version, ejecutar checks y build; transferir release inmutable mediante canal privado/CI definido, sin .env. Respaldar PostgreSQL antes de cambio; aplicar `npm run db:deploy` con identidad migrador y revisar estado, importar catálogo aprobado explícitamente. No seed ficticio ni reset/db push. Hacer smoke test del release con API/DB, actualizar enlace current y reiniciar servicio/proxy; verificar salud y logs. Conservar release anterior. Rollback de aplicación no revierte automáticamente esquema: usar cambios compatibles o nueva migración revisada; recuperar backup en base separada solo si procedimiento/impacto aprobados.

CI/CD pendiente de elección; las plantillas no configuran GitHub Actions ni hacen push. Registrar hash de release y resultado de pruebas, sin PII. Archivos comerciales/activos deben tener almacenamiento persistente validado, no depender del filesystem efímero de release.

## DNS, HTTPS y Stripe

Propietario confirma dominio/control y costo antes de compra. Crear zona Route53 y delegar NS conforme registrador; A a IP estática aprobada y www según dominio real, sin inventar dominio de tienda. Validar resolución y emisión TLS con proxy antes de habilitar pagos. Ejemplo tienda.example.invalid es deliberadamente no comercial y debe sustituirse. Registrar renovación, acceso y recuperación de DNS.

Config Stripe por entorno: NUXT_STRIPE_SITE_URL=https://dominio-aprobado y webhook `/api/payments/stripe/webhook` con secret específico, eventos soportados del módulo. URLs de retorno se derivan de sitio privado validado. Verificar cuenta live/keys separadas después de sandbox; firma y consultas de proveedor deben concordar, redirect no confirma. No se habilita live ni ejecuta cobro en esta tarea. Envia solo cotiza con origen/cajas reales; proveedor correo sigue pendiente, no seleccionar por cuenta propia.

## Procesos, observabilidad y recuperación

Timer de pagos cubre barrido de intentos/reservas; falta worker completo para reintentar inbox FAILED, reintegros/outbox y correo/reposición con proveedor elegido. No marcar mensajes enviados ni eventos procesados por simple conteo. Alarmar conteos por edad/estado y fallos, sin payload/cookies/secrets/PII. stdout/journal deben registrar resultados agregados, rotación y retención definidas; verificar que stack traces no filtren configuración. Métricas: salud, latencia, reservas vencidas inciertas, cola atrasada, cobros no aplicados, refunds pendientes y capacidad DB.

Definir backups cifrados y retención con responsable; probar pg_dump formato custom + restore en base nueva aislada comparando esquema/restricciones/movimientos y conteos, nunca sobrescribir producción como prueba. Documentar RPO/RTO medidos, recuperación de secrets/artefactos/DNS y reenvío seguro de webhooks. La prueba aislada de #33 no acredita backups AWS.

Validación final desde dominio: registro/login/logout/revocación, diez productos aprobados, carrito persistente tras reinicio, pedido sandbox, pago aprobado/rechazado/pendiente y webhook duplicado, vencimiento/reintento con navegador cerrado, reserva/stock/cupón/puntos únicos y restauración aislada. Guardar evidencia anonimizada por release. Pendientes: elección/presupuesto/región/dominio, aprovisionamiento autorizado, versión DB/roles/red, worker completo/correo, logs/backup/restore/HTTPS reales y demostración #38. Conservar #41 abierto.
