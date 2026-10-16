#!/usr/bin/env bash
# Requiere sudo. Programa una detención normal; conserva EBS y Elastic IP.
set -euo pipefail
stop_at=${1:-}
[[ "$stop_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$ ]] || { echo 'Fecha UTC inválida.' >&2; exit 1; }
calendar=$(date -u -d "$stop_at" '+%Y-%m-%d %H:%M:%S UTC')
cat > /etc/systemd/system/fitness-demo-stop.service <<'UNIT'
[Unit]
Description=Detener la instancia temporal de The Fitness Stuff
[Service]
Type=oneshot
ExecStart=/usr/sbin/shutdown -h now
UNIT
cat > /etc/systemd/system/fitness-demo-stop.timer <<UNIT
[Unit]
Description=Apagado de la demostracion al cumplir el plazo autorizado
[Timer]
OnCalendar=$calendar
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now fitness-demo-stop.timer
systemctl list-timers fitness-demo-stop.timer --no-pager
