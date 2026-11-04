#!/usr/bin/env bash
set -euo pipefail

echo "===> WordPing VPS Setup Script"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "===> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Check PM2
if ! command -v pm2 >/dev/null 2>&1; then
  echo "===> Installing PM2..."
  sudo npm install -g pm2
fi

# Install dependencies
echo "===> Installing root and web dependencies..."
npm ci
npm --prefix web ci

# Prisma generate & migrations
echo "===> Generating Prisma Client & Running Migrations..."
npx prisma generate
npx prisma migrate deploy

# Build backend and web app
echo "===> Building backend & web..."
npm run build
npm run build:web

# Start or restart PM2 services
echo "===> Starting PM2 services..."
if pm2 list | grep -q "wordping"; then
  npm run pm2:restart
else
  npm run pm2:start
fi

pm2 save

echo "===> WordPing services are up and running!"
pm2 status
