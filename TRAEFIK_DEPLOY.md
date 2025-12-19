# Deploy Deliverty with Traefik

This guide explains how to deploy Deliverty backend API on your own server with Traefik.

## Prerequisites

1. Server with Docker and Docker Compose installed
2. Traefik running as external network (see your Traefik setup)
3. Domain name configured to point to your server
4. Telegram bot token (from [@BotFather](https://t.me/BotFather))

## Setup Steps

### 1. Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` and set the following required variables:

```bash
# Required: Telegram Bot Configuration
TG_BOT_TOKEN=123456:ABC-your-bot-token
TG_BOT_NAME=deliverty_bot
TG_DEEPLINK_SECRET=your-random-secret-string-here

# Required: Database (use external Supabase or local postgres)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?sslmode=require

# Recommended: Frontend URL
FRONTEND_URL=https://your-frontend-domain.com

# Optional: Admin Configuration
ADMIN_SECRET_KEY=your-admin-secret-key-here
ADMIN_USER_IDS=123456789,987654321
```

**Generate secrets:**
```bash
# Generate TG_DEEPLINK_SECRET
openssl rand -hex 16

# Generate ADMIN_SECRET_KEY
openssl rand -hex 32
```

### 2. Update Domain in docker-compose.yml

Edit `docker-compose.yml` and replace `deliverty.findparty.online` with your domain:

```yaml
# Replace all occurrences of:
Host(`deliverty.findparty.online`)

# With your domain:
Host(`api.yourdomain.com`)
```

### 3. Database Options

#### Option A: Use External Database (Recommended for Production)

Set `DATABASE_URL` in `.env` to your Supabase or other PostgreSQL connection string.

**For Supabase:**
- Use Session Pooler (port 6543), NOT direct connection (5432)
- Get connection string from: Supabase Dashboard → Settings → Database → Connection string → Session mode

#### Option B: Use Local PostgreSQL

If you want to run PostgreSQL locally, use the `local-db` profile:

```bash
docker-compose --profile local-db up -d postgres
```

Then set `DATABASE_URL` in `.env` to:
```
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/deliverty?sslmode=disable
```

### 4. Build and Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Check migration status
docker-compose logs migrate
```

### 5. Verify Deployment

Check health endpoint:
```bash
curl https://your-domain.com/healthz
```

Should return: `{"ok":true}`

### 6. Configure Telegram Webhook

After the API is running, set the Telegram webhook:

```bash
export TG_BOT_TOKEN=your-bot-token-here
export BACKEND_URL=https://your-domain.com

curl -X POST "https://api.telegram.org/bot$TG_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$BACKEND_URL/bot/webhook\"}"
```

Verify webhook:
```bash
curl "https://api.telegram.org/bot$TG_BOT_TOKEN/getWebhookInfo"
```

### 7. Set Domain for Telegram Login Widget

For Telegram Login Widget to work in production:

1. Send `/setdomain` to [@BotFather](https://t.me/BotFather)
2. Select your bot
3. Provide your **frontend URL** (where Login Widget is hosted), NOT backend URL

## Traefik Configuration

The docker-compose.yml includes Traefik labels for:

- **API routes**: `https://your-domain.com/api/*`
- **Bot webhook**: `https://your-domain.com/bot/webhook`
- **Health check**: `https://your-domain.com/healthz`
- **HTTP → HTTPS redirect**: All HTTP traffic is redirected to HTTPS

All routes use:
- Entrypoint: `websecure` (HTTPS)
- TLS certificate resolver: `le` (Let's Encrypt)
- HTTP redirect middleware for automatic HTTPS

## Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart API
docker-compose restart api

# View logs
docker-compose logs -f api

# Run migrations manually
docker-compose run --rm migrate

# Update and rebuild
docker-compose pull
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Check Traefik Network

Ensure Traefik network exists:
```bash
docker network ls | grep traefik
```

If it doesn't exist, create it:
```bash
docker network create traefik
```

### Check Service Logs

```bash
# API logs
docker-compose logs api

# Migration logs
docker-compose logs migrate

# All logs
docker-compose logs
```

### Verify Traefik Labels

Check if Traefik is detecting the service:
```bash
docker inspect deliverty-api | grep -A 20 Labels
```

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check if database is accessible from Docker network
- For Supabase: Ensure you're using Session Pooler (port 6543)

### Health Check Failing

The health check uses `/healthz` endpoint. Verify it's accessible:
```bash
curl http://localhost:8080/healthz
```

If running in container:
```bash
docker-compose exec api wget -O- http://localhost:8080/healthz
```


