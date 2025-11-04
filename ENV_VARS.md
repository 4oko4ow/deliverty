# Environment Variables Reference

## Production Environment Variables

### Backend (API) - Render

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ **Required** | **MUST use Supabase Session Pooler (port 6543)** - Direct connection (5432) only supports IPv6 which Render doesn't support | `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?sslmode=require` or `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require` |
| `TG_BOT_TOKEN` | ✅ **Required** | Telegram bot token from [@BotFather](https://t.me/BotFather) | `123456:ABC-your-bot-token` |
| `TG_BOT_NAME` | ✅ **Required** | Telegram bot username (without @) | `deliverty_bot` |
| `TG_DEEPLINK_SECRET` | ✅ **Required** | Random secret string for deep link signing | `your-random-secret-string-here` |
| `HTTP_ADDR` | ❌ Optional | Server address (defaults to `:8080` or uses `PORT`) | `:8080` |
| `PORT` | ❌ Optional | Render/Heroku standard (auto-set by Render) | `10000` |

**Note**: `PORT` is automatically set by Render. The backend will use `PORT` if `HTTP_ADDR` is not set.

### Frontend Environment Variables

**Note**: Frontend is deployed separately (e.g., Vercel). Set these in your frontend hosting service:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE` | ✅ **Required** | Backend API base URL (must include `/api`) | `https://deliverty-api.onrender.com/api` |
| `VITE_TG_BOT` | ✅ **Required** | Telegram bot username (without @) | `deliverty_bot` |

## Quick Setup for Render Backend

```
# ⚠️ IMPORTANT: Use Session Pooler (port 6543), NOT direct connection (5432)
# Direct connection only supports IPv6, but Render requires IPv4
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?sslmode=require
TG_BOT_TOKEN=123456:ABC-your-bot-token
TG_BOT_NAME=deliverty_bot
TG_DEEPLINK_SECRET=your-random-secret-string-here
```

**How to get Session Pooler URL:**
1. Supabase Dashboard → Settings → Database
2. Find "Connection string" section
3. Select **"Session mode"** (NOT Transaction mode)
4. Copy the connection string with port **6543**

**Important**: After backend is deployed, use your Render backend URL in frontend's `VITE_API_BASE` environment variable.

## Local Development

See `README.md` for local development setup using Docker.

