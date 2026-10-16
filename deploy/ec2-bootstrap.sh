#!/usr/bin/env bash
# User-data sin secretos; instancia temporal del proyecto académico.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 curl openssl util-linux
systemctl enable --now docker
if [[ ! -e /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi
usermod -aG docker ubuntu
install -d -o ubuntu -g ubuntu -m 700 /opt/fitness-stuff
echo 'Fitness Stuff: Docker y usuario de despliegue preparados.'
