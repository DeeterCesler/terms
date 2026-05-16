#!/bin/bash
# One-time bootstrap for a fresh Hetzner Ubuntu 24.04 server.
# Run as root: bash setup.sh
set -euo pipefail

DEPLOY_USER="deploy"

echo "==> Updating packages"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing dependencies"
apt-get install -y -qq \
  curl git ufw nginx certbot python3-certbot-nginx \
  ca-certificates gnupg

echo "==> Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Installing Node.js 20 (for running migrations)"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

echo "==> Creating deploy user"
useradd -m -s /bin/bash "$DEPLOY_USER" || true
usermod -aG docker "$DEPLOY_USER"
mkdir -p /home/$DEPLOY_USER/.ssh
cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true

echo "==> Configuring firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

echo "==> Enabling Docker on boot"
systemctl enable docker
systemctl start docker

echo ""
echo "Done. Next steps:"
echo "  1. Log in as $DEPLOY_USER and clone the repo to ~/app"
echo "  2. Copy .env and fill in secrets"
echo "  3. Run infra/deploy.sh"
echo "  4. Run infra/ssl.sh <your-domain>"
