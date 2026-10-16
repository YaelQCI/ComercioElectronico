#!/usr/bin/env bash
# Ejecutar una vez en EC2 como el usuario de despliegue; no sobrescribe secretos.
set -euo pipefail
umask 077
root=${DEPLOY_ROOT:-/opt/fitness-stuff}
host=${1:-}
[[ "$root" = /* && "$root" != / ]] || { echo 'Directorio de despliegue inválido.' >&2; exit 1; }
[[ "$host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Indica la IP pública o nombre del servidor.' >&2; exit 1; }
for tool in docker openssl curl flock tar; do command -v "$tool" >/dev/null || { echo "Falta instalar $tool" >&2; exit 1; }; done
docker compose version >/dev/null
docker info >/dev/null
mkdir -p "$root/shared/tls" "$root/shared/backups" "$root/releases" "$root/incoming"
if [[ ! -e "$root/shared/.env" ]]; then
  (set -o noclobber; printf 'DOCKER_POSTGRES_PASSWORD=%s\nDOCKER_AUTH_SECRET=%s\nPUBLIC_HOST=%s\nNUXT_STRIPE_ENABLED=false\nNUXT_STRIPE_ENVIRONMENT=test\nNUXT_STRIPE_SITE_URL=https://%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -base64 32)" "$host" "$host" > "$root/shared/.env")
fi
chmod 600 "$root/shared/.env"
if [[ ! -e "$root/shared/tls/fullchain.pem" && ! -e "$root/shared/tls/privkey.pem" ]]; then
  san="DNS:$host"
  [[ "$host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && san="IP:$host"
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 365 \
    -keyout "$root/shared/tls/privkey.pem" -out "$root/shared/tls/fullchain.pem" \
    -subj "/CN=$host" -addext "subjectAltName=$san" 2>/dev/null
fi
[[ -s "$root/shared/tls/fullchain.pem" && -s "$root/shared/tls/privkey.pem" ]] || { echo 'Falta completar el certificado y su clave.' >&2; exit 1; }
echo "Servidor preparado en $root. HTTPS usa un certificado autofirmado para demostración; configura confianza o reemplázalo por uno público."
