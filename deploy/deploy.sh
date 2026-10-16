#!/usr/bin/env bash
set -euo pipefail
umask 077
root=${DEPLOY_ROOT:-/opt/fitness-stuff}
revision=${1:-}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Commit inválido.' >&2; exit 1; }
[[ "$root" = /* && "$root" != / ]] || { echo 'Directorio inválido.' >&2; exit 1; }
release="$root/releases/$revision"
[[ -f "$release/compose.ec2.yaml" && -f "$release/release.env" && -f "$root/shared/.env" ]] || { echo 'Falta preparar el servidor o la versión.' >&2; exit 1; }
[[ -s "$root/shared/tls/fullchain.pem" && -s "$root/shared/tls/privkey.pem" ]] || { echo 'Falta el certificado HTTPS.' >&2; exit 1; }
public_host=$(sed -n 's/^PUBLIC_HOST=//p' "$root/shared/.env" | tr -d '\r')
[[ "$public_host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'PUBLIC_HOST inválido en la configuración privada.' >&2; exit 1; }
export DEPLOY_ROOT="$root"
exec 9>"$root/deploy.lock"
flock -w 600 9 || { echo 'Hay otro despliegue en curso.' >&2; exit 1; }
compose=(docker compose --env-file "$root/shared/.env" --env-file "$release/release.env" -f "$release/compose.ec2.yaml")
setting() { sed -n "s/^$1=//p" "$root/shared/.env" | tr -d '\r'; }
shared_gateway=$(setting SHARED_GATEWAY)
environment=$(setting DEPLOY_ENVIRONMENT)
if [[ "$environment" = production ]]; then
  [[ "$(setting NUXT_STRIPE_ENVIRONMENT)" = live && "$(setting NUXT_DEMO_DATA_ENABLED)" = false ]] || { echo 'Producción exige entorno Stripe live y datos DEMO deshabilitados.' >&2; exit 1; }
  if [[ "$(setting NUXT_STRIPE_ENABLED)" = true ]]; then
    grep -Eq '^NUXT_STRIPE_SECRET_KEY=sk_live_[A-Za-z0-9]+\r?$' "$root/shared/.env" || { echo 'Producción requiere clave live.' >&2; exit 1; }
  fi
elif [[ "$environment" = staging ]]; then
  [[ "$(setting NUXT_STRIPE_ENVIRONMENT)" = test ]] || { echo 'Staging solo permite Stripe test.' >&2; exit 1; }
fi
"${compose[@]}" config --quiet
images=(app migrate postgres)
[[ "$shared_gateway" = true ]] || images+=(proxy)
"${compose[@]}" pull "${images[@]}"
"${compose[@]}" up -d --wait --wait-timeout 180 postgres

# El dump se completa y valida antes de aplicar cualquier migración.
backup="$root/shared/backups/$(date -u +%Y%m%dT%H%M%SZ)-$revision.dump"
"${compose[@]}" exec -T postgres pg_dump -U fitness -d fitness_ec2 -Fc > "$backup.partial"
[[ -s "$backup.partial" ]]
"${compose[@]}" exec -T postgres pg_restore --list < "$backup.partial" > /dev/null
mv "$backup.partial" "$backup"

# Mantiene la aplicación anterior si la migración falla. No revierte esquema automáticamente.
"${compose[@]}" run --rm --no-deps migrate
if [[ "$environment" = production ]]; then
  "${compose[@]}" run --rm --no-deps migrate node scripts/hide-production-demo.mjs
fi
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 app
if [[ "$shared_gateway" = true ]]; then
  app_port=$(setting APP_PORT)
  [[ "$app_port" = 3001 || "$app_port" = 3002 ]] || { echo 'Puerto de entorno inválido.' >&2; exit 1; }
  curl --fail --silent --show-error --retry 6 --retry-connrefused --retry-all-errors --retry-delay 2 \
    "http://127.0.0.1:$app_port/api/health" --connect-timeout 10 --max-time 15 > /dev/null
else
  "${compose[@]}" run --rm --no-deps proxy nginx -t
  "${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 90 proxy
fi
if [[ "$shared_gateway" != true || "$(setting PUBLIC_HTTPS_READY)" = true ]]; then
  tls_options=()
  [[ "$(setting PUBLIC_CERT_TRUSTED)" = true ]] || tls_options=(--cacert "$root/shared/tls/fullchain.pem")
  curl --fail --silent --show-error --retry 6 --retry-connrefused --retry-all-errors --retry-delay 2 \
    "${tls_options[@]}" "https://$public_host/api/health" --resolve "$public_host:443:127.0.0.1" \
    --connect-timeout 10 --max-time 15 > /dev/null
fi

# Activación explícita desde la configuración privada, sin ejecutar el .env como código.
if grep -Eq '^NUXT_STRIPE_ENABLED=(true|"true")\r?$' "$root/shared/.env"; then
  "${compose[@]}" --profile payments pull payment-reconciler
  "${compose[@]}" --profile payments up -d --no-deps payment-reconciler
else
  "${compose[@]}" --profile payments stop payment-reconciler
fi
if [[ -L "$root/current" ]]; then readlink "$root/current" > "$root/previous-release"; fi
ln -sfn "releases/$revision" "$root/current"
printf '%s\n' "$revision" > "$root/current-commit"
echo "Despliegue $revision completado. Respaldo: $backup"
