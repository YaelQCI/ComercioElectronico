#!/usr/bin/env bash
# Ejecutar en la EC2 cuando ambos registros DNS apunten a la IP elástica.
set -euo pipefail
umask 077
production=${1:-}
staging=${2:-stagging.$production}
gateway=/opt/fitness-stuff-gateway
[[ -s "$gateway/ip" && -f "$gateway/render-gateway.py" ]]
exec 9>"$gateway/domains.lock"
flock -w 120 9
python3 - "$production" "$staging" "$(cat "$gateway/ip")" <<'PY'
import ipaddress, re, socket, sys
production, staging, expected = sys.argv[1:]
ipaddress.IPv4Address(expected)
for host in (production, staging):
    if len(host) > 253 or '.' not in host or not all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', part) for part in host.split('.')):
        raise SystemExit('Dominio inválido.')
    addresses = {entry[4][0] for entry in socket.getaddrinfo(host, 80, socket.AF_INET)}
    if addresses != {expected}:
        raise SystemExit('Ambos registros A deben apuntar exclusivamente a la IP de esta EC2.')
    try:
        ipv6 = socket.getaddrinfo(host, 80, socket.AF_INET6)
    except socket.gaierror:
        ipv6 = []
    if ipv6:
        raise SystemExit('Retira el registro AAAA: esta EC2 no tiene IPv6 configurada.')
if production == staging:
    raise SystemExit('Los dominios deben ser distintos.')
PY
sudo certbot certonly --webroot -w "$gateway/acme" --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring \
  --cert-name "$production" -d "$production" -d "$staging"
python3 "$gateway/render-gateway.py" --ip "$(cat "$gateway/ip")" --production "$production" --staging "$staging" --output "$gateway/conf.d/default.conf.next"
cp "$gateway/conf.d/default.conf" "$gateway/default.conf.previous"
mv "$gateway/conf.d/default.conf.next" "$gateway/conf.d/default.conf"
compose=(docker compose -f "$gateway/compose.gateway.yaml")
if ! "${compose[@]}" exec -T gateway nginx -t; then
  cp "$gateway/default.conf.previous" "$gateway/conf.d/default.conf"
  exit 1
fi
"${compose[@]}" exec -T gateway nginx -s reload
python3 - "$production" "$staging" <<'PY'
from pathlib import Path
import os, sys
for root, host in [('/opt/fitness-stuff-production', sys.argv[1]), ('/opt/fitness-stuff', sys.argv[2])]:
    path = Path(root) / 'shared/.env'
    values = dict(PUBLIC_HOST=host, PUBLIC_HTTPS_READY='true', PUBLIC_CERT_TRUSTED='true', NUXT_STRIPE_SITE_URL='https://' + host)
    original = path.read_text()
    backup = path.with_name('.env.before-domains')
    if not backup.exists():
        backup.write_text(original)
        os.chmod(backup, 0o600)
    lines = [line for line in original.splitlines() if line.split('=', 1)[0] not in values]
    temporary = path.with_name('.env.domains.tmp')
    temporary.write_text('\n'.join(lines + [key + '=' + value for key, value in values.items()]) + '\n')
    os.chmod(temporary, 0o600)
    temporary.replace(path)
PY
for root in /opt/fitness-stuff /opt/fitness-stuff-production; do
  docker compose --env-file "$root/shared/.env" --env-file "$root/current/release.env" -f "$root/current/compose.ec2.yaml" up -d --no-deps --wait --wait-timeout 180 app
  if grep -q '^NUXT_STRIPE_ENABLED=true$' "$root/shared/.env"; then
    docker compose --env-file "$root/shared/.env" --env-file "$root/current/release.env" -f "$root/current/compose.ec2.yaml" --profile payments up -d --no-deps payment-reconciler
  fi
done
for host in "$production" "$staging"; do
  curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 2 "https://$host/api/health" > /dev/null
done
sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
printf '#!/usr/bin/env bash\nset -euo pipefail\ndocker compose -f /opt/fitness-stuff-gateway/compose.gateway.yaml exec -T gateway nginx -t\ndocker compose -f /opt/fitness-stuff-gateway/compose.gateway.yaml exec -T gateway nginx -s reload\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/fitness-gateway.sh > /dev/null
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/fitness-gateway.sh
sudo systemctl enable --now certbot.timer
printf 'Producción: https://%s\nStaging: https://%s\n' "$production" "$staging"
