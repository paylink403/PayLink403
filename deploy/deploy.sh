#!/bin/bash
# Deploy script for sn1ffprotocol.com

set -e
APP_DIR="/var/www/sn1ffprotocol"

echo "=== Deploying Sn1ff Protocol ==="

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
fi

# Setup directory
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
cd $APP_DIR

# Copy files (or git clone)
# git clone https://github.com/YOUR_USER/paylink-paid-redirect.git .

# Install & build
npm ci
npm run build
npm run build:server

# Setup .env
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Edit .env with your settings!"
fi

# Setup nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/sn1ffprotocol.com
sudo ln -sf /etc/nginx/sites-available/sn1ffprotocol.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d sn1ffprotocol.com -d www.sn1ffprotocol.com

# Setup systemd
sudo cp deploy/sn1ffprotocol.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sn1ffprotocol
sudo systemctl restart sn1ffprotocol

echo "=== Done! Server running at https://sn1ffprotocol.com ==="
