#!/usr/bin/env bash
# Lecturas contra ambos entornos; proxy efímero solo en loopback, sin modificar DNS.
set -euo pipefail
[[ ${CHECK_SHARED_GATEWAY:-} = true ]] || { echo 'Activa CHECK_SHARED_GATEWAY solo en la EC2 preparada.' >&2; exit 1; }
root=$(cd "$(dirname "$0")/.." && pwd)
temporary=$(mktemp -d)
name="fitness-gateway-check-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$temporary"; }
trap cleanup EXIT
mkdir -p "$temporary/letsencrypt/live/production.example.invalid"
certificate="$temporary/letsencrypt/live/production.example.invalid"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 1 -keyout "$certificate/privkey.pem" -out "$certificate/fullchain.pem" \
  -subj /CN=production.example.invalid -addext 'subjectAltName=DNS:production.example.invalid,DNS:stagging.production.example.invalid' >/dev/null 2>&1
python3 "$root/deploy/render-gateway.py" --ip 52.37.189.103 --production production.example.invalid --staging stagging.production.example.invalid --output "$temporary/default.conf"
sed -i -e 's/listen 80 /listen 127.0.0.1:18080 /g' -e 's/listen 443 /listen 127.0.0.1:18443 /g' "$temporary/default.conf"
docker run -d --rm --name "$name" --network host \
  -v "$temporary/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$temporary/letsencrypt:/etc/letsencrypt:ro" \
  -v /opt/fitness-stuff/shared/tls:/etc/nginx/ip-tls:ro \
  nginx:stable-alpine@sha256:970364228b1e4f932abc22d321932816782cca8a20b85a77552a7cfe9acfb3b5 >/dev/null
for host in production.example.invalid stagging.production.example.invalid; do
  curl --noproxy '*' --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 1 \
    --cacert "$certificate/fullchain.pem" --resolve "$host:18443:127.0.0.1" "https://$host:18443/api/catalog/products" > "$temporary/$host.json"
done
python3 - "$temporary" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
assert json.loads((root / 'production.example.invalid.json').read_text())['catalogTotal'] == 0
assert json.loads((root / 'stagging.production.example.invalid.json').read_text())['catalogTotal'] == 28
print('Proxy TLS: cada dominio llega a su catálogo; certificado verificado, sin cambios de DNS ni escrituras comerciales.')
PY
