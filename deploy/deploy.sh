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
"${compose[@]}" config --quiet
"${compose[@]}" pull app migrate postgres proxy
"${compose[@]}" up -d --wait --wait-timeout 180 postgres

# El dump se completa y valida antes de aplicar cualquier migración.
backup="$root/shared/backups/$(date -u +%Y%m%dT%H%M%SZ)-$revision.dump"
"${compose[@]}" exec -T postgres pg_dump -U fitness -d fitness_ec2 -Fc > "$backup.partial"
[[ -s "$backup.partial" ]]
"${compose[@]}" exec -T postgres pg_restore --list < "$backup.partial" > /dev/null
mv "$backup.partial" "$backup"

# Mantiene la aplicación anterior si la migración falla. No revierte esquema automáticamente.
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 app
"${compose[@]}" run --rm --no-deps proxy nginx -t
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 90 proxy
curl --fail --silent --show-error --retry 6 --retry-connrefused --retry-all-errors --retry-delay 2 \
  --cacert "$root/shared/tls/fullchain.pem" "https://$public_host/api/health" --resolve "$public_host:443:127.0.0.1" \
  --connect-timeout 10 --max-time 15 > /dev/null

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
