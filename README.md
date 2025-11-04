# Deliverty

A monorepo for the Deliverty platform - a peer-to-peer delivery service connecting people who need to send packages/documents with travelers who are already flying on the same route.

## Structure

```
deliverty/
├── backend/        # Go backend API
├── frontend/       # React frontend
└── ops/            # Docker and deployment configuration
```

## Quick Start

### Local Development (Docker)

For local development, we use Docker Compose to run PostgreSQL locally.

#### 1. Database Setup (Local Dev)

Start PostgreSQL and Adminer using Docker Compose:

```bash
cd ops
docker compose up -d
```

This will:
- Start PostgreSQL on port `5433` (mapped from container port 5432)
- Start Adminer (database admin UI) on port `8081`
- Automatically run migrations on first boot

Access Adminer at: http://localhost:8081
- System: `PostgreSQL`
- Server: `db`
- Username: `postgres`
- Password: `postgres`
- Database: `deliverty`

#### 2. Backend Setup (Local Dev)

Create a `.env` file in the `ops/` directory:

```bash
cd ops
cat > .env << EOF
DATABASE_URL=postgres://postgres:postgres@localhost:5433/deliverty?sslmode=disable
HTTP_ADDR=:8080
TG_BOT_TOKEN=123456:ABC-your-bot-token
TG_BOT_NAME=deliverty_bot
TG_DEEPLINK_SECRET=choose-a-random-long-string
EOF
```

**Note**: For local development, use port `5433` (Docker mapped port).

**Get Telegram Bot Token:**
1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the token (format: `123456:ABC-...`)
4. Set `TG_BOT_NAME` to your bot's username (without @)
5. Choose a random string for `TG_DEEPLINK_SECRET`

#### Production (Supabase)

For production, use Supabase Postgres. Set the `DATABASE_URL` environment variable to your Supabase connection string:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres?sslmode=require
```

The application automatically uses the `DATABASE_URL` environment variable - no code changes needed!

Run the backend:

```bash
export $(cat ops/.env | xargs)
go run ./backend/cmd/api
```

### 3. Set Telegram Webhook

After the backend is running, configure the Telegram webhook (replace `DOMAIN` with your backend URL):

```bash
BOT=your-bot-token-here
curl -X POST "https://api.telegram.org/bot$BOT/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://DOMAIN/bot/webhook"}'
```

For local development with ngrok:
```bash
# Install ngrok, then:
ngrok http 8080

# Use the https URL provided by ngrok in the webhook:
curl -X POST "https://api.telegram.org/bot$BOT/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-ngrok-url.ngrok.io/bot/webhook"}'
```

### 4. Frontend Setup

Copy environment template and configure:

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```env
VITE_API_BASE=http://localhost:8080/api
VITE_TG_BOT=deliverty_bot
```

Install dependencies and run:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: http://localhost:5173

### 5. Telegram Bot Setup for Login Widget

The app uses Telegram Login Widget for authentication (no need to host as Mini App):

1. **Create Bot** (if not done already):
   - Talk to [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow instructions
   - Get your bot token and username

2. **Set Domain for Login Widget**:
   
   **For Production:**
   - Send `/setdomain` to @BotFather
   - Select your bot
   - Provide your **frontend URL** (where Login Widget is hosted)
     - **If using Vercel**: `your-project.vercel.app` (or your custom domain)
     - **If using other hosting**: your frontend domain (e.g., `your-domain.com`)
   - ⚠️ **Important**: Use your **frontend URL** (Vercel), NOT backend URL (Render)
   - This is **required** for the Login Widget to work in production
   
   **For Local Development:**
   - Option A: Use a tunnel service (ngrok, localtunnel, etc.)
     ```bash
     # Install ngrok, then:
     ngrok http 5173  # or your frontend port
     # Use the ngrok URL (e.g., https://abc123.ngrok.io) in /setdomain
     ```
   - Option B: Skip auth setup and use fallback user ID
     - The app will use `123456789` as fallback in dev mode
     - No Telegram auth needed for local testing

3. **Configure Frontend**:
   - Set `VITE_TG_BOT` in `frontend/.env` to your bot username (without @)
   - Example: `VITE_TG_BOT=deliverty_bot`

4. **User Registration**:
   - Users visit `/auth` page and click "Login with Telegram"
   - They authorize via Telegram Login Widget
   - User ID is saved to localStorage and user is created in database
   - No manual registration needed!

**Important**: 
- Domain is **required for production** use
- For local dev, you can use tunnels (ngrok) or skip auth entirely (fallback mode)
- The Login Widget will only work on the domain you set via `/setdomain`

## Health Checks

Test the API endpoints:

```bash
# Health check
curl http://localhost:8080/healthz

# Airport search
curl "http://localhost:8080/api/airports?q=bkk"
```

## Testing

Run the end-to-end QA test script:

```bash
cd ops
./qa_test.sh
```

Or run individual test commands manually - see `ops/qa_commands.md` for detailed curl commands and test cases.

## Development Workflow

**Run Order:**
1. Database: `cd ops && docker compose up -d`
2. Backend: Set env vars, then `go run ./backend/cmd/api`
3. Frontend: `cd frontend && npm run dev`

**API Endpoints:**
- `GET /healthz` - Health check
- `GET /api/airports?q=search` - Airport search
- `GET /api/auth/telegram` - Telegram Login Widget callback
- `POST /api/publications` - Create publication (requires `X-TG-User-ID` header)
- `GET /api/publications?from=BKK&to=SVO` - List publications
- `GET /api/matches?pub_id=123` - Find matches
- `POST /api/deals` - Create deal
- `POST /bot/webhook` - Telegram bot webhook

## Features

- **Publications**: Create requests (need to send something) or trips (flying and can take something along)
- **Matching**: Automatic matching based on route, dates, and weight compatibility
- **Deals**: Connect senders and travelers via secure Telegram relay
- **Ratings**: Simple rating system for completed deals
- **Reminders**: Automatic pre-flight reminders (24h and 3h before)
- **Content Policy**: Banned items filtering and description validation
- **Rate Limiting**: IP-based rate limiting to prevent abuse
- **Anti-Spam**: Duplicate publication detection
- **Telegram Authentication**: Login via Telegram Login Widget (OAuth-like, no Mini App required)

## Production Deployment

### Database Configuration

**Production uses Supabase Postgres** - set the `DATABASE_URL` environment variable to your Supabase connection string. The application automatically uses this variable - no code changes needed!

See `ops/` directory for:
- `nginx.conf.example` - Nginx reverse proxy configuration
- `deliverty-api.service.example` - Systemd service file (set `DATABASE_URL` to your Supabase URL)
- `deploy.sh` - Automated build and deployment script

**Quick deploy:**
```bash
./ops/deploy.sh user@your-server.com
```

**Important**: Make sure to set `DATABASE_URL` environment variable in your production environment to your Supabase Postgres connection string.

## Airports Dataset

Import airport data from CSV:

```bash
# For local development (Docker):
go run ./backend/cmd/airports-load \
  "postgres://postgres:postgres@localhost:5433/deliverty?sslmode=disable" \
  ./ops/airports.csv

# For production (Supabase):
go run ./backend/cmd/airports-load \
  "$DATABASE_URL" \
  ./ops/airports.csv
```

## MVP Checklist

See `ops/MVP_CHECKLIST.md` for complete readiness checklist.

## License

[Add your license here]
