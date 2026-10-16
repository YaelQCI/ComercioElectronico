#!/usr/bin/env bash
# Solo staging: requiere stripe-cli.env y stripe-webhook.secret privados en shared/.
set -euo pipefail
umask 077
root=/opt/fitness-stuff
image=stripe/stripe-cli@sha256:11c46caeead82e329f14823dd622d494b4cc8c1b9766f724d122d2af42c97540
[[ -L "$root/current" && -s "$root/shared/stripe-cli.env" && -s "$root/shared/stripe-webhook.secret" ]]
python3 - <<'PY'
from pathlib import Path
from datetime import datetime, timezone
import os, re

root = Path('/opt/fitness-stuff/shared')
def env(path):
    return dict(line.split('=', 1) for line in path.read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
key = env(root / 'stripe-cli.env').get('STRIPE_API_KEY', '')
secret = (root / 'stripe-webhook.secret').read_text().strip()
host = env(root / '.env').get('PUBLIC_HOST', '')
if not re.fullmatch(r'sk_test_[A-Za-z0-9]+', key):
    raise SystemExit('Se requiere una clave exclusiva de pruebas.')
if not re.fullmatch(r'whsec_[A-Za-z0-9]+', secret):
    raise SystemExit('Se requiere el secreto del listener de esta instancia.')
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', host):
    raise SystemExit('Host de staging inválido.')
values = dict(NUXT_STRIPE_ENABLED='true', NUXT_STRIPE_ENVIRONMENT='test', NUXT_STRIPE_SECRET_KEY=key, NUXT_STRIPE_WEBHOOK_SECRET=secret, NUXT_STRIPE_SITE_URL='https://' + host)
original = (root / '.env').read_text()
backup = root / ('.env.before-stripe-test-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
with backup.open('x') as file:
    file.write(original)
os.chmod(backup, 0o600)
lines = [line for line in original.splitlines() if line.split('=', 1)[0] not in values]
temporary = root / '.env.stripe-test.tmp'
temporary.write_text('\n'.join(lines + [k + '=' + v for k, v in values.items()]) + '\n')
os.chmod(temporary, 0o600)
temporary.replace(root / '.env')
PY
chmod 600 "$root/shared/stripe-cli.env" "$root/shared/stripe-webhook.secret"
sudo tee /etc/systemd/system/fitness-stripe-test-listener.service > /dev/null <<UNIT
[Unit]
Description=Stripe CLI de pruebas para staging The Fitness Stuff
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=simple
Restart=always
RestartSec=10
ExecStartPre=-/usr/bin/docker rm -f fitness-stripe-test-listener
ExecStart=/usr/bin/docker run --rm --name fitness-stripe-test-listener --network host --log-driver none --env-file $root/shared/stripe-cli.env $image --device-name fitness-stuff-staging listen --events-from @self --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed --forward-to http://127.0.0.1:3001/api/payments/stripe/webhook
ExecStop=/usr/bin/docker stop -t 15 fitness-stripe-test-listener
TimeoutStopSec=30
# Stripe CLI imprime su secreto al arrancar: no guardarlo en Docker ni journal.
StandardOutput=null
StandardError=null
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now fitness-stripe-test-listener.service
cd "$root/current"
compose=(docker compose --env-file "$root/shared/.env" --env-file release.env -f compose.ec2.yaml)
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 app
# El gateway compartido usa loopback y no depende de la IP del contenedor.
if ! grep -q '^SHARED_GATEWAY=true$' "$root/shared/.env"; then
  "${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 90 proxy
fi
"${compose[@]}" --profile payments up -d --no-deps payment-reconciler
sudo systemctl is-active --quiet fitness-stripe-test-listener.service
echo 'Stripe test habilitado; listener y reconciliador activos. No se ejecutaron cobros.'
