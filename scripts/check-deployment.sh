#!/usr/bin/env bash
# Prueba el protocolo de despliegue con comandos simulados, sin tocar Docker ni un servidor.
set -euo pipefail
source_root=$(cd "$(dirname "$0")/.." && pwd)
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
mkdir -p "$temporary/bin"
export DEPLOY_TEST_LOG="$temporary/events"
cat > "$temporary/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  *'exec -T postgres pg_dump'*) [[ ${DEPLOY_TEST_FAIL:-} != backup ]] || exit 1; printf 'respaldo-sintetico';;
  *'exec -T postgres pg_restore'*) cat >/dev/null;;
  *'run --rm --no-deps migrate'*) [[ ${DEPLOY_TEST_FAIL:-} != migration ]] || exit 1;;
  *'--wait-timeout 180 app'*) [[ ${DEPLOY_TEST_FAIL:-} != app ]] || exit 1;;
esac
MOCK
cat > "$temporary/bin/curl" <<'MOCK'
#!/usr/bin/env bash
printf 'health\n' >> "$DEPLOY_TEST_LOG"
[[ ${DEPLOY_TEST_FAIL:-} != health ]]
MOCK
chmod +x "$temporary/bin/docker" "$temporary/bin/curl"
export PATH="$temporary/bin:$PATH"
revision=1111111111111111111111111111111111111111
prepare() {
  export DEPLOY_ROOT="$temporary/$1"
  mkdir -p "$DEPLOY_ROOT/releases/$revision" "$DEPLOY_ROOT/shared/tls" "$DEPLOY_ROOT/shared/backups"
  cp "$source_root/deploy/compose.ec2.yaml" "$source_root/deploy/nginx.conf" "$DEPLOY_ROOT/releases/$revision/"
  printf 'APP_IMAGE=fixture\nTOOLS_IMAGE=fixture\n' > "$DEPLOY_ROOT/releases/$revision/release.env"
  printf 'PUBLIC_HOST=192.0.2.1\nNUXT_STRIPE_ENABLED=false\n' > "$DEPLOY_ROOT/shared/.env"
  printf 'fixture' > "$DEPLOY_ROOT/shared/tls/fullchain.pem"
  printf 'fixture' > "$DEPLOY_ROOT/shared/tls/privkey.pem"
  : > "$DEPLOY_TEST_LOG"
}
prepare success
bash "$source_root/deploy/deploy.sh" "$revision" > /dev/null
[[ $(cat "$DEPLOY_ROOT/current-commit") == "$revision" && -L "$DEPLOY_ROOT/current" ]]
[[ $(find "$DEPLOY_ROOT/shared/backups" -name '*.dump' | wc -l) == 1 ]]
[[ $(grep -n 'pg_dump' "$DEPLOY_TEST_LOG" | cut -d: -f1) -lt $(grep -n 'run --rm --no-deps migrate' "$DEPLOY_TEST_LOG" | cut -d: -f1) ]]
! grep -q 'down\|volume rm\|prune' "$DEPLOY_TEST_LOG"
grep -q 'stop payment-reconciler' "$DEPLOY_TEST_LOG"
for failure in backup migration app health; do
  prepare "$failure"
  export DEPLOY_TEST_FAIL="$failure"
  if bash "$source_root/deploy/deploy.sh" "$revision" > /dev/null 2>&1; then echo "Se aceptó indebidamente el fallo $failure" >&2; exit 1; fi
  [[ ! -e "$DEPLOY_ROOT/current-commit" && ! -e "$DEPLOY_ROOT/current" ]]
  if [[ "$failure" == backup ]]; then ! grep -q 'run --rm --no-deps migrate' "$DEPLOY_TEST_LOG"; fi
  if [[ "$failure" == migration ]]; then ! grep -q -- '--wait-timeout 180 app' "$DEPLOY_TEST_LOG"; fi
  unset DEPLOY_TEST_FAIL
done
prepare payments
printf 'PUBLIC_HOST=192.0.2.1\nNUXT_STRIPE_ENABLED=true\n' > "$DEPLOY_ROOT/shared/.env"
bash "$source_root/deploy/deploy.sh" "$revision" > /dev/null
grep -q 'up -d --no-deps payment-reconciler' "$DEPLOY_TEST_LOG"
if bash "$source_root/deploy/deploy.sh" '../../fuera' > /dev/null 2>&1; then exit 1; fi
prepare production
printf 'PUBLIC_HOST=production.pending.invalid\nNUXT_STRIPE_ENABLED=false\nNUXT_STRIPE_ENVIRONMENT=live\nNUXT_DEMO_DATA_ENABLED=false\nDEPLOY_ENVIRONMENT=production\nSHARED_GATEWAY=true\nAPP_PORT=3002\nPUBLIC_HTTPS_READY=false\n' > "$DEPLOY_ROOT/shared/.env"
bash "$source_root/deploy/deploy.sh" "$revision" > /dev/null
grep -q 'hide-production-demo.mjs' "$DEPLOY_TEST_LOG"
! grep -q 'run --rm --no-deps proxy\|force-recreate.*proxy' "$DEPLOY_TEST_LOG"
prepare unsafe-production
printf 'PUBLIC_HOST=production.pending.invalid\nDEPLOY_ENVIRONMENT=production\nNUXT_STRIPE_ENVIRONMENT=test\n' > "$DEPLOY_ROOT/shared/.env"
if bash "$source_root/deploy/deploy.sh" "$revision" >/dev/null 2>&1; then echo 'Producción aceptó Stripe test' >&2; exit 1; fi
! grep -q 'pg_dump\|run --rm --no-deps migrate' "$DEPLOY_TEST_LOG"
export DEPLOY_ROOT="$temporary/bootstrap"
bash "$source_root/deploy/prepare-server.sh" 192.0.2.1 > /dev/null
first_checksum=$(sha256sum "$DEPLOY_ROOT/shared/.env")
bash "$source_root/deploy/prepare-server.sh" 192.0.2.1 > /dev/null
[[ $(sha256sum "$DEPLOY_ROOT/shared/.env") == "$first_checksum" ]]
openssl x509 -in "$DEPLOY_ROOT/shared/tls/fullchain.pem" -noout -checkip 192.0.2.1 | grep -q 'does match'
echo 'Despliegue: respaldo antes de migrar, fallos bloqueados, salud, configuración de pagos y conservación de volúmenes correctos (comandos simulados).'
