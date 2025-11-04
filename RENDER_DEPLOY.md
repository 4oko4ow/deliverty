# Deploy Backend to Render

This guide explains how to deploy Deliverty **backend API** to Render.

## Prerequisites

1. [Render account](https://render.com) (free tier available)
2. Supabase Postgres database (get connection string from Supabase dashboard)
3. Telegram bot token (from [@BotFather](https://t.me/BotFather))

## Environment Variables

### Backend (API) Environment Variables

Set these in Render Dashboard → Your Service → Environment:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | Supabase Postgres connection string | `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres?sslmode=require` |
| `TG_BOT_TOKEN` | ✅ Yes | Telegram bot token from BotFather | `123456:ABC-your-bot-token` |
| `TG_BOT_NAME` | ✅ Yes | Telegram bot username (without @) | `deliverty_bot` |
| `TG_DEEPLINK_SECRET` | ✅ Yes | Random secret string for deep link signing | `your-random-secret-string-here` |
| `HTTP_ADDR` | ❌ No | Server address (defaults to `:8080` or uses `PORT`) | `:8080` |

**Note**: Render automatically sets `PORT` environment variable. The backend will use `PORT` if `HTTP_ADDR` is not set.

## Deployment Steps

### Option 1: Manual Setup (Recommended)

Deploy backend as **Web Service**:

#### Step 1: Deploy Backend (Web Service)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your Git repository (GitHub/GitLab/Bitbucket)
4. Configure:
   - **Name**: `deliverty-api`
   - **Region**: Choose closest to your users (e.g., `Oregon`, `Frankfurt`)
   - **Branch**: `main` (or your main branch)
   - **Root Directory**: `backend`
   - **Environment**: `Go` ⚠️ **Important**: Make sure to select "Go" not "Docker"
   - **Build Command**: `go mod download && go build -o api ./cmd/api`
   - **Start Command**: `./api`
   - **Health Check Path**: `/healthz`
   
   **Note**: If Render auto-detects Docker, go to "Advanced" settings and ensure "Environment" is set to "Go" (not "Docker").

5. Add environment variables:
   - `DATABASE_URL` - Your Supabase Postgres connection string
   - `TG_BOT_TOKEN` - Telegram bot token
   - `TG_BOT_NAME` - Bot username (without @)
   - `TG_DEEPLINK_SECRET` - Random secret string

6. Click "Create Web Service"
7. Wait for deployment to complete
8. Note your backend URL (e.g., `https://deliverty-api.onrender.com`)

#### Step 2: Update Telegram Webhook

After backend is deployed, set the Telegram webhook:

```bash
BOT_TOKEN=your-bot-token-here
BACKEND_URL=https://deliverty-api.onrender.com  # Replace with your actual URL

curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$BACKEND_URL/bot/webhook\"}"
```

Verify webhook is set:
```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

### Option 2: Using Blueprint (Alternative)

If you prefer using a blueprint:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Blueprint"
3. Connect your Git repository
4. Render will detect `render.yaml` if present
5. Review and adjust the service
6. Set environment variables in the service
7. Click "Apply" to deploy

**Note**: The `render.yaml` file only includes the backend service. Frontend should be deployed separately (e.g., Vercel, Netlify, or another hosting provider).

## Database Setup

### Run Migrations

After deploying, you need to run database migrations. You can do this locally:

```bash
# Install psql or use Supabase SQL Editor
# Or use the Supabase dashboard SQL Editor to run migration files:
# - backend/migrations/001_init.sql
# - backend/migrations/002_airports.sql
# - backend/migrations/003_rating_log.sql
# - backend/migrations/004_reminders.sql
```

Alternatively, connect to Supabase and run migrations via Supabase SQL Editor.

### Load Airport Data

You can load airport data using the airports-load tool:

```bash
# Run locally pointing to Supabase
go run ./backend/cmd/airports-load \
  "$DATABASE_URL" \
  ./ops/airports.csv
```

## Custom Domain (Optional)

1. Go to your service in Render Dashboard
2. Navigate to "Settings" → "Custom Domains"
3. Add your domain
4. Update DNS records as instructed by Render
5. SSL certificates are automatically provisioned

## Updating Deployments

Render automatically deploys when you push to the connected branch. To manually trigger:

1. Go to service in Render Dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

## Troubleshooting

### Docker build error: "/backend": not found

If you see an error like `failed to solve: failed to compute cache key: "/backend": not found`, Render is trying to use Docker instead of native Go build.

**Solution:**
1. Go to your service in Render Dashboard
2. Click "Settings" → Scroll to "Build & Deploy"
3. Under "Environment", change from "Docker" to "Go"
4. Ensure "Root Directory" is set to `backend`
5. Ensure "Build Command" is: `go mod download && go build -o api ./cmd/api`
6. Ensure "Start Command" is: `./api`
7. Save and redeploy

Alternatively, if using Blueprint:
- Delete the service and recreate it manually using the steps above
- Or temporarily rename/remove `backend/Dockerfile` if you're not using Docker

### Backend not starting

- Check logs in Render Dashboard
- Verify all environment variables are set
- Verify `DATABASE_URL` is correct and accessible
- Check health check endpoint: `https://your-api.onrender.com/healthz`

### Database connection errors

- Verify Supabase connection string is correct
- Check Supabase firewall settings (allow connections from Render IPs)
- Verify database exists and migrations are run

### Telegram webhook not working

- Verify webhook URL is accessible (public HTTPS)
- Check backend logs for webhook requests
- Verify `TG_BOT_TOKEN` is correct
- Test webhook manually: `curl https://your-api.onrender.com/bot/webhook`

## Render Free Tier Limitations

- Services spin down after 15 minutes of inactivity (free tier)
- First request after spin-down may be slow (cold start)
- Free tier has resource limits (CPU/RAM)
- Consider upgrading for production use

## Cost Considerations

- **Backend**: Free tier available, or $7/month for always-on service
- **Database**: Supabase free tier or paid plan

## Frontend Deployment

For frontend deployment, you can use:
- **Vercel** (see `VERCEL_DEPLOY.md`)
- **Netlify**
- **GitHub Pages**
- Or any other static hosting service

Make sure to set `VITE_API_BASE` to your Render backend URL (e.g., `https://deliverty-api.onrender.com/api`).

## Next Steps

1. Set up monitoring (Render provides basic logs)
2. Configure custom domain
3. Set up CI/CD for automated testing before deployment
4. Consider upgrading to paid tier for production reliability

