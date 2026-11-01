#!/bin/bash
set -euo pipefail

# ─── WANNABE Turnkey SSL Provisioning Tool ────────────────────────────────
# Automates Let's Encrypt certificate acquisition via Certbot HTTP-01 challenge

COMPOSE_FILE="docker-compose.prod.yml"

echo "=========================================================="
echo "    WANNABE Public Deployment: SSL/TLS Provisioning       "
echo "=========================================================="

if [ -f .env ]; then
  # Load DOMAIN_NAME and SSL_EMAIL from .env if present
  export $(grep -v '^#' .env | grep -E '^(DOMAIN_NAME|SSL_EMAIL)=' | xargs)
fi

DOMAIN="${1:-${DOMAIN_NAME:-}}"
EMAIL="${2:-${SSL_EMAIL:-}}"

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "scanner.example.com" ]; then
  read -rp "Enter your public domain name (e.g. scanner.myorg.com): " DOMAIN
fi

if [ -z "$EMAIL" ] || [ "$EMAIL" = "admin@example.com" ]; then
  read -rp "Enter contact email for Let's Encrypt renewal notices: " EMAIL
fi

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Error: Both domain name and email are required." >&2
  exit 1
fi

echo ""
echo "Target Domain: $DOMAIN"
echo "Contact Email: $EMAIL"
echo ""

# Ensure ./deploy/certs directory exists
mkdir -p deploy/certs

echo "[1/4] Ensuring frontend Nginx container is running..."
docker compose -f "$COMPOSE_FILE" up -d frontend

echo "[2/4] Requesting official Let's Encrypt certificate for $DOMAIN..."
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint "\
  certbot certonly --webroot \
    -w /var/www/certbot \
    -d '$DOMAIN' \
    --email '$EMAIL' \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --keep-until-expiring" certbot

echo "[3/4] Linking official certificates to Nginx mount directory..."
# Certbot saves to /etc/letsencrypt/live/$DOMAIN inside container, which maps to ./deploy/certs/live/$DOMAIN
if [ -d "deploy/certs/live/$DOMAIN" ]; then
  cp -L "deploy/certs/live/$DOMAIN/fullchain.pem" deploy/certs/fullchain.pem
  cp -L "deploy/certs/live/$DOMAIN/privkey.pem" deploy/certs/privkey.pem
  chmod 600 deploy/certs/privkey.pem
  chmod 644 deploy/certs/fullchain.pem
  echo "Certificates installed successfully to deploy/certs/"
fi

echo "[4/4] Reloading Nginx to activate trusted SSL certificate..."
docker compose -f "$COMPOSE_FILE" exec frontend nginx -s reload

echo ""
echo "=========================================================="
echo "✅ TLS Certificate successfully installed and active!"
echo "   Test with: curl -I https://$DOMAIN"
echo "=========================================================="
