# Environment Variables Reference

## Production Environment Variables

### Backend (API) - Render

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ **Required** | **MUST use Supabase Session Pooler (port 6543)** - Direct connection (5432) only supports IPv6 which Render doesn't support | `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?sslmode=require` or `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require` |
| `TG_BOT_TOKEN` | ✅ **Required** | Telegram bot token from [@BotFather](https://t.me/BotFather) | `123456:ABC-your-bot-token` |
| `TG_BOT_NAME` | ✅ **Required** | Telegram bot username (without @) | `deliverty_bot` |
| `TG_DEEPLINK_SECRET` | ✅ **Required** | Random secret string for deep link signing | `your-random-secret-string-here` |
| `FRONTEND_URL` | ⚠️ **Recommended** | Frontend URL for auth redirects (auto-detected from Referer if not set) | `https://your-project.vercel.app` |
| `ADMIN_SECRET_KEY` | ❌ Optional | Secret key for admin endpoints (for manually adding publications via API) | `your-admin-secret-key` |
| `ADMIN_USER_IDS` | ❌ Optional | Comma-separated list of Telegram user IDs for admin access (for web interface) | `123456789,987654321` |
| `HTTP_ADDR` | ❌ Optional | Server address (defaults to `:8080` or uses `PORT`) | `:8080` |
| `PORT` | ❌ Optional | Render/Heroku standard (auto-set by Render) | `10000` |

**Note**: `PORT` is automatically set by Render. The backend will use `PORT` if `HTTP_ADDR` is not set.

### Frontend Environment Variables

**Note**: Frontend is deployed separately (e.g., Vercel). Set these in your frontend hosting service:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE` | ✅ **Required** | Backend API base URL (must include `/api`) | `https://deliverty-api.onrender.com/api` |
| `VITE_TG_BOT` | ✅ **Required** | Telegram bot username (without @) | `deliverty_bot` |
| `VITE_SUPPORT_TELEGRAM` | ❌ Optional | Telegram username for support (without @) - shows support banner | `your_username` |
| `VITE_PUBLIC_POSTHOG_KEY` | ❌ Optional | PostHog project API key for analytics | `phc_xxxxxxxxxxxxxxxxxxxx` |
| `VITE_PUBLIC_POSTHOG_HOST` | ❌ Optional | PostHog host URL (defaults to `https://app.posthog.com`) | `https://app.posthog.com` or `https://us.i.posthog.com` or `https://eu.posthog.com` |

## Quick Setup for Render Backend

```
# ⚠️ IMPORTANT: Use Session Pooler (port 6543), NOT direct connection (5432)
# Direct connection only supports IPv6, but Render requires IPv4
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?sslmode=require
TG_BOT_TOKEN=123456:ABC-your-bot-token
TG_BOT_NAME=deliverty_bot
TG_DEEPLINK_SECRET=your-random-secret-string-here
FRONTEND_URL=https://your-project.vercel.app
ADMIN_SECRET_KEY=your-admin-secret-key-here  # Optional: for admin endpoints
```

**How to get Session Pooler URL:**
1. Supabase Dashboard → Settings → Database
2. Find "Connection string" section
3. Select **"Session mode"** (NOT Transaction mode)
4. Copy the connection string with port **6543**

**Important**: After backend is deployed, use your Render backend URL in frontend's `VITE_API_BASE` environment variable.

## Telegram Bot Setup

### Step 1: Create Bot and Get Token

1. Talk to [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newbot` and follow instructions
3. Save your bot token and username

### Step 2: Configure Environment Variables

Set these in your backend (Render) environment variables:
- `TG_BOT_TOKEN` - Bot token from BotFather
- `TG_BOT_NAME` - Bot username (without @)
- `TG_DEEPLINK_SECRET` - Random secret string (generate with: `openssl rand -hex 16`)

### Step 3: Set Telegram Webhook ⚠️ **REQUIRED**

After backend is deployed, you **MUST** configure the Telegram webhook so the bot can receive messages.

**Option A: Using the setup script** (recommended):
```bash
export TG_BOT_TOKEN=your-bot-token-here
./ops/setup_webhook.sh https://your-backend-url.onrender.com
```

**Option B: Manual setup**:
```bash
BOT_TOKEN=your-bot-token-here
BACKEND_URL=https://your-backend-url.onrender.com

curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$BACKEND_URL/bot/webhook\"}"
```

**Verify webhook is set**:
```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

**⚠️ Important**: 
- Webhook URL must be HTTPS (required by Telegram)
- Backend must be publicly accessible
- Webhook endpoint is `/bot/webhook` (no authentication required)

### Step 4: Set Domain for Login Widget

For Telegram Login Widget to work in production:

1. Send `/setdomain` to [@BotFather](https://t.me/BotFather)
2. Select your bot
3. Provide your **frontend URL** (where Login Widget is hosted)
   - **If using Vercel**: `your-project.vercel.app` (or your custom domain)
   - **If using other hosting**: your frontend domain
   - ⚠️ **Important**: Use your **frontend URL**, NOT backend URL

**For local development**:
- Use a tunnel service (ngrok, localtunnel) or skip auth (uses fallback user ID in dev mode)

## Admin Endpoints

Для раннего релиза доступен админ-эндпоинт для ручного добавления объявлений от имени других пользователей.

### Настройка

1. **Для веб-интерфейса** (рекомендуется): Установите переменную окружения `ADMIN_USER_IDS` со списком ваших Telegram user ID:
   ```bash
   ADMIN_USER_IDS=123456789,987654321
   ```
   После этого вы сможете зайти на `/admin` через веб-интерфейс, авторизовавшись через Telegram.

2. **Для API-доступа**: Установите переменную окружения `ADMIN_SECRET_KEY`:
   ```bash
   ADMIN_SECRET_KEY=your-secret-key-here
   ```
   Рекомендуется сгенерировать случайный ключ:
   ```bash
   openssl rand -hex 32
   ```
   Используйте этот ключ в заголовке `X-Admin-Key` при вызове админ-эндпоинтов.

**Примечание**: Можно использовать оба способа одновременно. Доступ будет предоставлен, если пройдена хотя бы одна проверка.

### Создание публикации от имени другого пользователя

**Endpoint**: `POST /api/admin/publications`

**Headers**:
- `X-Admin-Key`: ваш секретный ключ
- `Content-Type`: `application/json`

**Body** (JSON):
```json
{
  "kind": "request",  // или "trip"
  "from_iata": "SVO",
  "to_iata": "JFK",
  "date_start": "2024-12-20",  // для request
  "date_end": "2024-12-25",    // для request
  "date": "2024-12-22",        // для trip (вместо date_start/date_end)
  "item": "documents",         // или "small"
  "weight": "envelope",        // или "le1kg", "le3kg"
  "reward_hint": 1000,         // опционально
  "description": "Описание объявления",
  "flight_no": "SU100",        // опционально, для trip
  "airline": "Aeroflot",       // опционально, для trip
  "capacity_hint": "envelope/1kg",  // опционально, для trip
  
  // Один из этих полей обязателен для указания пользователя:
  "tg_user_id": 123456789,     // Telegram user ID
  "tg_username": "username"    // или Telegram username (без @)
}
```

**Пример запроса**:
```bash
curl -X POST https://your-api.onrender.com/api/admin/publications \
  -H "X-Admin-Key: your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "request",
    "from_iata": "SVO",
    "to_iata": "JFK",
    "date_start": "2024-12-20",
    "date_end": "2024-12-25",
    "item": "documents",
    "weight": "envelope",
    "description": "Нужно доставить документы",
    "tg_username": "external_user"
  }'
```

**Особенности**:
- Админ-эндпоинт обходит ограничения (5 активных публикаций, проверка дубликатов)
- Если пользователь с указанным `tg_username` не существует, он будет создан автоматически
- Если указан только `tg_username` без `tg_user_id`, для внешних пользователей будет создан специальный отрицательный ID

### Веб-интерфейс

Доступен по адресу `/admin` после авторизации через Telegram (если ваш `tg_user_id` указан в `ADMIN_USER_IDS`).

**Важно о регистрации пользователей**:
- Если вы создали публикацию от имени пользователя с `tg_username` (без `tg_user_id`), для него будет создан пользователь с отрицательным ID
- Когда реальный пользователь с таким же `tg_username` зарегистрируется в системе, он создаст нового пользователя с реальным `tg_user_id`
- Публикации останутся привязанными к старому пользователю с отрицательным ID
- **Рекомендация**: Используйте реальный `tg_user_id`, если он известен, или используйте уникальные `tg_username` для внешних пользователей (например, `external_user_1`, `external_user_2`)

## Local Development

See `README.md` for local development setup using Docker.

