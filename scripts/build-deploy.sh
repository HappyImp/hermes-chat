#!/usr/bin/env bash
# build-deploy.sh — Build frontend and deploy to Nginx
set -euo pipefail

cd /root/hermes-chat

echo "=== Building ==="
npm run build

echo "=== Deploying ==="
# Create data directory for active employees
mkdir -p dist/data

# Copy active employees data if it exists
if [[ -f /tmp/employees-active.json ]]; then
  cp /tmp/employees-active.json dist/data/
fi

# Deploy to Nginx
sudo rm -rf /var/www/chat/*
sudo cp -r dist/* /var/www/chat/

# Ensure data directory exists in production
sudo mkdir -p /var/www/chat/data
if [[ -f /tmp/employees-active.json ]]; then
  sudo cp /tmp/employees-active.json /var/www/chat/data/
fi

echo "=== Reload Nginx ==="
sudo nginx -t && sudo nginx -s reload

echo "=== Verify ==="
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:5244/chat/
echo "Done!"
