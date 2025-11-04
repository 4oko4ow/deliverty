#!/bin/bash
# Deployment script for Deliverty
# Usage: ./deploy.sh [server] [path]

set -e

SERVER="${1:-user@your-server.com}"
DEPLOY_PATH="${2:-/srv/deliverty-api}"
FRONTEND_PATH="/srv/deliverty-frontend"

echo "=== Building API ==="

# Build API binary
docker run --rm \
  -v "$(pwd):/w" \
  -w /w \
  golang:1.22-alpine \
  sh -c 'cd backend && go build -ldflags="-s -w" -o ../dist/api ./cmd/api'

echo "=== Building Frontend ==="

# Build frontend
cd frontend
npm ci
npm run build
cd ..

echo "=== Deploying to $SERVER ==="

# Deploy API
echo "Uploading API..."
ssh "$SERVER" "mkdir -p $DEPLOY_PATH"
scp dist/api "$SERVER:$DEPLOY_PATH/api"
ssh "$SERVER" "sudo chown www-data:www-data $DEPLOY_PATH/api && sudo chmod +x $DEPLOY_PATH/api"

# Deploy frontend
echo "Uploading frontend..."
ssh "$SERVER" "sudo mkdir -p $FRONTEND_PATH"
rsync -az --delete frontend/dist/ "$SERVER:$FRONTEND_PATH/"

# Restart service
echo "Restarting service..."
ssh "$SERVER" "sudo systemctl restart deliverty-api"

echo "=== Deployment Complete ==="
echo "API: $DEPLOY_PATH/api"
echo "Frontend: $FRONTEND_PATH"
