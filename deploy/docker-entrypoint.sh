#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"
CERTBOT_DIR="/var/www/certbot"

# Ensure directories exist
mkdir -p "$CERT_DIR" "$CERTBOT_DIR"

# If SSL certificates do not exist, generate fallback self-signed certificates
# so Nginx starts without crashing on port 443 before Let's Encrypt / Certbot runs
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "[wannabe:nginx] No existing SSL certificate found at $CERT_FILE"
  echo "[wannabe:nginx] Generating fallback self-signed SSL certificate for bootstrapping..."
  
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=US/ST=State/L=City/O=WANNABE/CN=localhost" \
    >/dev/null 2>&1

  chmod 600 "$KEY_FILE"
  chmod 644 "$CERT_FILE"
  echo "[wannabe:nginx] Fallback self-signed certificate generated successfully."
  echo "[wannabe:nginx] To install a trusted Let's Encrypt certificate, run: ./deploy/init-ssl.sh"
else
  echo "[wannabe:nginx] SSL certificate found at $CERT_FILE"
fi

exec "$@"
