#!/usr/bin/env bash
# Stack temporal con nombre/volúmenes propios. Nunca usa el Compose ni los datos locales.
set -euo pipefail
umask 077
source_root=$(cd "$(dirname "$0")/.." && pwd)
temporary=$(mktemp -d)
export DEPLOY_ROOT="$temporary"
export DEPLOY_CHECK_PROJECT="fitness-check-$(openssl rand -hex 6)"
app_image=${DEPLOY_CHECK_APP_IMAGE:-fitness-ci:validation}
tools_image=${DEPLOY_CHECK_TOOLS_IMAGE:-fitness-stuff-local-tests}
docker image inspect "$app_image" "$tools_image" >/dev/null
bash "$source_root/deploy/prepare-server.sh" localhost
printf 'APP_IMAGE=%s\nTOOLS_IMAGE=%s\n' "$app_image" "$tools_image" > "$temporary/release.env"
cat > "$temporary/override.yaml" <<'YAML'
services:
  app:
    ports: !override ['127.0.0.1:3301:3000']
  proxy:
    ports: !override ['127.0.0.1:8080:80', '127.0.0.1:8443:443']
volumes:
  postgres_data:
    name: ${DEPLOY_CHECK_PROJECT}-postgres
  catalog_uploads:
    name: ${DEPLOY_CHECK_PROJECT}-uploads
YAML
compose=(docker compose -p "$DEPLOY_CHECK_PROJECT" --env-file "$temporary/shared/.env" --env-file "$temporary/release.env" -f "$source_root/deploy/compose.ec2.yaml" -f "$temporary/override.yaml")
cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$temporary"
}
trap cleanup EXIT
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 180 postgres
"${compose[@]}" exec -T postgres pg_dump -U fitness -d fitness_ec2 -Fc > "$temporary/before.dump"
"${compose[@]}" exec -T postgres pg_restore --list < "$temporary/before.dump" > /dev/null
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --wait --wait-timeout 180 app proxy
TEST_DEPLOYMENT_ISOLATED=true TEST_DEPLOYMENT_CA="$temporary/shared/tls/fullchain.pem" node "$source_root/scripts/check-deployment-https.mjs"
