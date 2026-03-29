#!/bin/bash
# -----------------------------------------------------------
# init-letsencrypt.sh — Bootstrap Let's Encrypt certificates
#
# Usage (run once on the VPS):
#   chmod +x nginx/init-letsencrypt.sh
#   N8N_DOMAIN=n8n.example.com CERTBOT_EMAIL=admin@example.com ./nginx/init-letsencrypt.sh
# -----------------------------------------------------------

set -euo pipefail

if [ -z "${N8N_DOMAIN:-}" ] || [ -z "${CERTBOT_EMAIL:-}" ]; then
  echo "Error: N8N_DOMAIN and CERTBOT_EMAIL must be set"
  echo "Usage: N8N_DOMAIN=n8n.example.com CERTBOT_EMAIL=admin@example.com $0"
  exit 1
fi

echo "==> Requesting certificate for $N8N_DOMAIN..."

# 1. Start nginx with HTTP-only config for ACME challenge
docker compose up -d nginx

# 2. Request certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$N8N_DOMAIN"

# 3. Reload nginx with full SSL config
docker compose exec nginx nginx -s reload

echo "==> Certificate obtained! HTTPS is now active for $N8N_DOMAIN"
echo "==> Auto-renewal is handled by the certbot container (every 12h)"
