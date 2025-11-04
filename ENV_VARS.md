# Environment Variables Reference

## Production Environment Variables

### Backend (API) - Render

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ **Required** | Supabase Postgres connection string. **Use Connection Pooling URL (port 6543) to avoid IPv6 issues** | `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?sslmode=require` |
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
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres?sslmode=require
TG_BOT_TOKEN=123456:ABC-your-bot-token
TG_BOT_NAME=deliverty_bot
TG_DEEPLINK_SECRET=your-random-secret-string-here
```

**Important**: After backend is deployed, use your Render backend URL in frontend's `VITE_API_BASE` environment variable.

## Local Development

See `README.md` for local development setup using Docker.

