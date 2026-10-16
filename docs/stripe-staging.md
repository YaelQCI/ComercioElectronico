# Stripe de pruebas en EC2

La instancia temporal `https://52.37.189.103` usa Stripe en entorno `test`. El certificado web sigue siendo autofirmado. Para recibir eventos de prueba sin exponer un webhook con ese certificado, Stripe CLI mantiene una conexión saliente y los reenvía a `http://127.0.0.1:3001/api/payments/stripe/webhook` dentro de la EC2. No depende de una terminal o computadora local.

La clave `sk_test_…` se verificó con una lectura de saldo que confirmó `livemode=false`, y se transfirió por SSH a la configuración privada del servidor. No se reutilizó el secreto del listener local: se obtuvo el de la instancia con el dispositivo `fitness-stuff-staging`. Las claves no se guardan en GitHub, imágenes Docker ni archivos versionados.

## Servicios y archivos privados

- `/opt/fitness-stuff/shared/.env`: aplicación y reconciliador, `NUXT_STRIPE_ENABLED=true`, entorno `test`, clave de prueba, secreto del listener y URL de retorno de staging.
- `/opt/fitness-stuff/shared/stripe-cli.env`: `STRIPE_API_KEY` de pruebas y actualización automática deshabilitada; permisos 600.
- `/opt/fitness-stuff/shared/stripe-webhook.secret`: secreto de firma del listener; permisos 600.
- `fitness-stripe-test-listener.service`: servicio systemd habilitado al arrancar, con reinicio automático y una imagen oficial de Stripe CLI fijada por digest. Solo escucha los tres eventos soportados de la propia cuenta.
- `payment-reconciler`: servicio Compose del perfil `payments`, con barrido cada minuto y reinicio automático.

El listener no publica puertos. Su salida se descarta en systemd y Docker porque Stripe CLI muestra el secreto al iniciarse. El script `deploy/enable-stripe-test.sh` conserva un respaldo privado de la configuración, rechaza claves live, instala el servicio y recrea aplicación/proxy. Los futuros despliegues conservan las variables privadas y mantienen el reconciliador al detectar pagos habilitados. El listener de systemd continúa independiente de las versiones de la aplicación.

Comprobaciones operativas:

```bash
systemctl is-active fitness-stripe-test-listener.service
systemctl is-enabled fitness-stripe-test-listener.service
cd /opt/fitness-stuff/current
docker compose --env-file /opt/fitness-stuff/shared/.env --env-file release.env -f compose.ec2.yaml --profile payments ps
```

Si cambia la clave o el dispositivo del listener, obtener nuevamente el secreto mediante `stripe listen --print-secret`, guardándolo privadamente; mantener el mismo dispositivo en el servicio. Para retirar esta modalidad temporal: detener/deshabilitar `fitness-stripe-test-listener.service`, desactivar Stripe en la configuración privada y recrear aplicación/reconciliador según corresponda. Para producción se requiere un destino HTTPS confiable y credenciales/secreto de producción propios.

## Verificación y límites

Se comprobaron la clave de pruebas contra Stripe, sintaxis del script, arranque saludable de aplicación/proxy, listener activo sin reinicios, reconciliador activo y login ADMIN por HTTPS. Una petición sintética con firma correcta y `livemode=true` fue rechazada por el control de entorno; esta prueba no creó eventos persistidos, pedidos, sesiones Checkout ni pagos.

Falta completar una compra de prueba real y comprobar la llegada del evento de ese pedido a través del listener. Las políticas siguen sin publicar y la configuración comercial de la tienda sigue pendiente; esta activación no aprueba esos contenidos ni elimina sus validaciones. Los datos del catálogo continúan siendo de demostración.

Referencia oficial: [Stripe CLI: recepción y reenvío de eventos, secreto y modo de pruebas](https://docs.stripe.com/cli/listen).
