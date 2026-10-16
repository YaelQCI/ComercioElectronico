#!/usr/bin/env bash
# Conserva los datos existentes como staging; producción usa recursos nuevos.
set -euo pipefail
umask 077
source_root=$(cd "$(dirname "$0")/.." && pwd)
staging=/opt/fitness-stuff
production=/opt/fitness-stuff-production
gateway=/opt/fitness-stuff-gateway
ip=${1:-}
[[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ && -L "$staging/current" ]]
[[ ! -L "$production/current" ]] || { echo 'Los dos entornos ya están preparados.'; exit 0; }
revision=$(cat "$staging/current-commit")
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
exec 9>"$staging/prepare-environments.lock"
flock -w 120 9
previous=(docker compose --env-file "$staging/shared/.env" --env-file "$staging/current/release.env" -f "$staging/current/compose.ec2.yaml")
backup="$staging/shared/backups/before-two-environments-$(date -u +%Y%m%dT%H%M%SZ).dump"
"${previous[@]}" exec -T postgres pg_dump -U fitness -d fitness_ec2 -Fc > "$backup.partial"
"${previous[@]}" exec -T postgres pg_restore --list < "$backup.partial" > /dev/null
mv "$backup.partial" "$backup"
sudo install -d -m 700 -o "$(id -un)" -g "$(id -gn)" "$production" "$gateway"
mkdir -p "$gateway/conf.d" "$gateway/acme/.well-known/acme-challenge"
chmod 755 "$gateway/acme" "$gateway/acme/.well-known" "$gateway/acme/.well-known/acme-challenge"
sudo install -d -m 755 /etc/letsencrypt
DEPLOY_ROOT="$production" bash "$source_root/deploy/prepare-server.sh" production.pending.invalid
python3 - <<'PY'
from pathlib import Path
import os
def values(path):
    return dict(line.split('=',1) for line in path.read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
staging = Path('/opt/fitness-stuff/shared/.env')
original = staging.read_text()
staging.with_name('.env.before-two-environments').write_text(original)
contact = {key: value for key, value in values(staging).items() if key in ['NUXT_PUBLIC_CONTACT_EMAIL', 'NUXT_PUBLIC_CONTACT_PHONE', 'NUXT_PUBLIC_SERVICE_HOURS']}
for path, settings in [
    (staging, dict(COMPOSE_PROJECT_NAME='fitness-stuff-ec2', POSTGRES_VOLUME='fitness-stuff-ec2-postgres', UPLOADS_VOLUME='fitness-stuff-ec2-uploads', APP_PORT='3001', DEPLOY_ENVIRONMENT='staging', SHARED_GATEWAY='true', PUBLIC_HTTPS_READY='true', PUBLIC_CERT_TRUSTED='false', NUXT_DEMO_DATA_ENABLED='true', NUXT_STRIPE_ENVIRONMENT='test')),
    (Path('/opt/fitness-stuff-production/shared/.env'), dict(COMPOSE_PROJECT_NAME='fitness-stuff-production', POSTGRES_VOLUME='fitness-stuff-production-postgres', UPLOADS_VOLUME='fitness-stuff-production-uploads', APP_PORT='3002', DEPLOY_ENVIRONMENT='production', SHARED_GATEWAY='true', PUBLIC_HTTPS_READY='false', PUBLIC_CERT_TRUSTED='false', NUXT_DEMO_DATA_ENABLED='false', NUXT_STRIPE_ENABLED='false', NUXT_STRIPE_ENVIRONMENT='live', NUXT_ENVIA_ENVIRONMENT='production', **contact)),
]:
    lines = [line for line in path.read_text().splitlines() if line.split('=',1)[0] not in settings]
    temp = path.with_name('.env.environments.tmp')
    temp.write_text('\n'.join(lines + [key+'='+value for key,value in settings.items()])+'\n')
    os.chmod(temp, 0o600)
    temp.replace(path)
PY
release="$production/releases/$revision"
mkdir -p "$release"
cp "$source_root/deploy/compose.ec2.yaml" "$source_root/deploy/deploy.sh" "$source_root/deploy/nginx.conf" "$release/"
cp "$staging/current/release.env" "$release/release.env"
compose=(docker compose --env-file "$production/shared/.env" --env-file "$release/release.env" -f "$release/compose.ec2.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 180 postgres
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" run --rm --no-deps -v "$source_root/scripts/hide-production-demo.mjs:/app/scripts/hide-production-demo.mjs:ro" migrate node scripts/hide-production-demo.mjs
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 app
curl --fail --silent --show-error http://127.0.0.1:3002/api/health > /dev/null
ln -sfn "releases/$revision" "$production/current"
printf '%s\n' "$revision" > "$production/current-commit"
cp "$source_root/deploy/compose.gateway.yaml" "$source_root/deploy/render-gateway.py" "$source_root/deploy/configure-domains.sh" "$gateway/"
printf '%s\n' "$ip" > "$gateway/ip"
python3 "$gateway/render-gateway.py" --ip "$ip" --output "$gateway/conf.d/default.conf"
edge=(docker compose -f "$gateway/compose.gateway.yaml")
"${edge[@]}" run --rm --no-deps gateway nginx -t
"${previous[@]}" stop proxy
if ! "${edge[@]}" up -d --wait --wait-timeout 90 gateway; then
  "${edge[@]}" stop gateway
  "${previous[@]}" up -d --wait --wait-timeout 90 proxy
  echo 'No se pudo iniciar el proxy compartido; se recuperó el proxy anterior.' >&2
  exit 1
fi
curl --fail --silent --show-error --cacert "$staging/shared/tls/fullchain.pem" "https://$ip/api/health" > /dev/null
# Mismo proyecto/volúmenes en staging: solo cambia su configuración de despliegue.
cp "$source_root/deploy/compose.ec2.yaml" "$source_root/deploy/deploy.sh" "$staging/current/"
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y certbot > /dev/null
echo 'Staging conservado y producción aislada preparados. HTTPS por dominio pendiente de DNS.'
