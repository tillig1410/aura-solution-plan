#!/usr/bin/env bash
set -euo pipefail

# =============================================================
#  Resaapp — VPS Setup Script (n8n + Redis + Nginx + SSL)
#  Target: Ubuntu 24.04 — Hostinger KVM 2
# =============================================================

DOMAIN="n8n.resaapp.fr"
EMAIL="admin@resaapp.fr"
PROJECT_DIR="/opt/resaapp"

echo "=============================="
echo "  Resaapp VPS Setup"
echo "=============================="

# --- 1. System updates ---
echo "[1/7] Mise à jour système..."
apt-get update -qq && apt-get upgrade -y -qq

# --- 2. Install Docker Compose plugin (if not present) ---
echo "[2/7] Vérification Docker Compose..."
if ! docker compose version &>/dev/null; then
  echo "  Installation de Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
docker compose version

# --- 3. Create project directory ---
echo "[3/7] Création du répertoire projet..."
mkdir -p "$PROJECT_DIR/nginx"
cd "$PROJECT_DIR"

# --- 4. Create .env file ---
echo "[4/7] Création du fichier .env..."
REDIS_PASS=$(openssl rand -hex 24)
cat > .env <<ENVEOF
# Domain
N8N_DOMAIN=${DOMAIN}

# Redis
REDIS_PASSWORD=${REDIS_PASS}
REDIS_URL=redis://:${REDIS_PASS}@redis:6379

# n8n (remove dev port in production)
N8N_DEV_PORT=127.0.0.1:5678
ENVEOF

echo "  Redis password généré automatiquement."

# --- 5. Create docker-compose.yml ---
echo "[5/7] Création de docker-compose.yml..."
cat > docker-compose.yml <<'DCEOF'
name: resaapp

services:
  # --- Reverse proxy (HTTPS termination) ---
  nginx:
    image: nginx:1.27-alpine
    container_name: resaapp-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/n8n.conf.template:/etc/nginx/templates/default.conf.template:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_certs:/etc/letsencrypt:ro
    environment:
      - N8N_DOMAIN=${N8N_DOMAIN:?N8N_DOMAIN is required in .env}
    depends_on:
      n8n:
        condition: service_healthy
    networks:
      - frontend
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M

  # --- Let's Encrypt auto-renewal ---
  certbot:
    image: certbot/certbot:v3.3.0
    container_name: resaapp-certbot
    volumes:
      - certbot_www:/var/www/certbot
      - certbot_certs:/etc/letsencrypt
    entrypoint: /bin/sh -c "trap exit TERM; while :; do certbot renew --quiet; sleep 12h & wait $${!}; done"
    networks:
      - frontend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.1'
          memory: 64M

  # --- n8n workflow engine ---
  n8n:
    image: n8nio/n8n:1.93.0
    container_name: resaapp-n8n
    ports:
      - "${N8N_DEV_PORT:-127.0.0.1:5678}:5678"
    environment:
      - GENERIC_TIMEZONE=Europe/Paris
      - TZ=Europe/Paris
      - N8N_HOST=${N8N_DOMAIN:?N8N_DOMAIN is required in .env}
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_DOMAIN}/
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_BULL_REDIS_PORT=6379
      - QUEUE_BULL_REDIS_PASSWORD=${REDIS_PASSWORD:?REDIS_PASSWORD is required in .env}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - frontend
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:5678/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M

  # --- Redis (internal only) ---
  redis:
    image: redis:7-alpine
    container_name: resaapp-redis
    command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required in .env} --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD:?REDIS_PASSWORD is required in .env}
    volumes:
      - redis_data:/data
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a $$REDIS_PASSWORD ping | grep -q PONG"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 64M

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  n8n_data:
  redis_data:
  certbot_www:
  certbot_certs:
DCEOF

# --- 6. Create nginx config ---
echo "[6/7] Création de la config Nginx..."
cat > nginx/n8n.conf.template <<'NGEOF'
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=n8n_webhook:10m rate=30r/s;

# Redirect HTTP to HTTPS (+ ACME challenge)
server {
    listen 80;
    server_name ${N8N_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${N8N_DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${N8N_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${N8N_DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 5m;

    # n8n webhook endpoints
    location /webhook/ {
        limit_req zone=n8n_webhook burst=50 nodelay;

        proxy_pass http://n8n:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
    }

    # n8n UI and API
    location / {
        proxy_pass http://n8n:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGEOF

# --- 7. Get SSL certificate BEFORE starting nginx ---
echo "[7/7] Obtention du certificat SSL..."

# Stop anything on port 80
docker stop resaapp-nginx 2>/dev/null || true

# Get certificate using standalone mode
docker run --rm \
  -p 80:80 \
  -v resaapp_certbot_certs:/etc/letsencrypt \
  -v resaapp_certbot_www:/var/www/certbot \
  certbot/certbot:v3.3.0 \
  certonly --standalone \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

echo ""
echo "=============================="
echo "  SSL OK — Démarrage des services..."
echo "=============================="

# --- Start everything ---
cd "$PROJECT_DIR"
docker compose up -d

echo ""
echo "=============================="
echo "  TERMINÉ !"
echo "=============================="
echo ""
echo "  n8n : https://${DOMAIN}"
echo "  Redis password : ${REDIS_PASS}"
echo ""
echo "  Au premier accès, n8n te demandera"
echo "  de créer un compte admin."
echo ""
echo "  NOTE : Sauvegarde le Redis password !"
echo "=============================="
