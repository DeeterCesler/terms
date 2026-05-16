#!/bin/bash
# Obtain a Let's Encrypt cert and wire up nginx.
# Usage: bash infra/ssl.sh api.yourdomain.com
set -euo pipefail

DOMAIN="${1:?Usage: ssl.sh <domain>}"
NGINX_CONF="/etc/nginx/sites-available/term-checker"

echo "==> Configuring nginx for $DOMAIN"
sed "s/YOUR_DOMAIN/$DOMAIN/g" \
  "$(dirname "$0")/nginx.conf" > "$NGINX_CONF"

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/term-checker
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "==> Obtaining certificate"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN"

echo "==> Setting up auto-renewal"
systemctl enable certbot.timer
systemctl start certbot.timer

echo "==> Done. HTTPS is live at https://$DOMAIN"
