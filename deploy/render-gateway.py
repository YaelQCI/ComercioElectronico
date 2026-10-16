#!/usr/bin/env python3
"""Genera rutas del proxy; sin dominios solo publica staging por la IP actual."""
import argparse
import ipaddress
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--ip', required=True)
parser.add_argument('--production')
parser.add_argument('--staging')
parser.add_argument('--output', required=True)
args = parser.parse_args()
ipaddress.IPv4Address(args.ip)
if bool(args.production) != bool(args.staging):
    parser.error('Se requieren ambos dominios.')
for host in [args.production, args.staging]:
    if host and (len(host) > 253 or not all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', part) for part in host.split('.'))):
        parser.error('Dominio inválido.')
if args.production and args.production == args.staging:
    parser.error('Los dominios deben ser diferentes.')

proxy = '''
    client_max_body_size 21m;
    location / {
        proxy_pass http://127.0.0.1:PORT;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 10s;
        proxy_read_timeout 120s;
    }
'''
content = '''server {
    listen 80 default_server;
    server_name _;
    location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 308 https://$host$request_uri; }
}
server {
    listen 443 ssl default_server;
    server_name _;
    ssl_certificate /etc/nginx/ip-tls/fullchain.pem;
    ssl_certificate_key /etc/nginx/ip-tls/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
''' + proxy.replace('PORT', '3001') + '}\n'
if args.production:
    for host, port in [(args.production, '3002'), (args.staging, '3001')]:
        content += f'''server {{
    listen 443 ssl;
    server_name {host};
    ssl_certificate /etc/letsencrypt/live/{args.production}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{args.production}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
''' + proxy.replace('PORT', port) + '}\n'
Path(args.output).write_text(content)
