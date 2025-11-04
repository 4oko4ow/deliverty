# Deliverty

A monorepo for the Deliverty platform - a peer-to-peer courier matching service connecting travelers with senders.

## Structure

```
deliverty/
├── backend/        # Go backend API
├── frontend/       # React frontend
└── ops/            # Docker and deployment configuration
```

## Quick Start

### 1. Database Setup

Start PostgreSQL and Adminer using Docker Compose:

```bash
cd ops
docker compose up -d
```

This will:
- Start PostgreSQL on port `5432`
- Start Adminer (database admin UI) on port `8081`
- Automatically run migrations on first boot

Access Adminer at: http://localhost:8081
- System: `PostgreSQL`
- Server: `db`
- Username: `postgres`
- Password: `postgres`
- Database: `deliverty`

### 2. Backend Setup

Copy the environment template and configure:

```bash
cp ops/.env.example ops/.env
```

Edit `ops/.env` with your values:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/deliverty?sslmode=disable
HTTP_ADDR=:8080
TG_BOT_TOKEN=123456:ABC-your-bot-token
TG_BOT_NAME=deliverty_bot
TG_DEEPLINK_SECRET=choose-a-random-long-string
```

**Get Telegram Bot Token:**
1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the token (format: `123456:ABC-...`)
4. Set `TG_BOT_NAME` to your bot's username (without @)
5. Choose a random string for `TG_DEEPLINK_SECRET`

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
- `POST /api/publications` - Create publication (requires `X-TG-User-ID` header)
- `GET /api/publications?from=BKK&to=SVO` - List publications
- `GET /api/matches?pub_id=123` - Find matches
- `POST /api/deals` - Create deal
- `POST /bot/webhook` - Telegram bot webhook

## Features

- **Publications**: Create requests or trips with route, dates, and details
- **Matching**: Automatic matching based on route, dates, and weight compatibility
- **Deals**: Connect senders and couriers via secure Telegram relay
- **Ratings**: Simple rating system for completed deals
- **Reminders**: Automatic pre-flight reminders (24h and 3h before)
- **Content Policy**: Banned items filtering and description validation
- **Rate Limiting**: IP-based rate limiting to prevent abuse
- **Anti-Spam**: Duplicate publication detection

## Production Deployment

See `ops/` directory for:
- `nginx.conf.example` - Nginx reverse proxy configuration
- `deliverty-api.service.example` - Systemd service file
- `deploy.sh` - Automated build and deployment script

**Quick deploy:**
```bash
./ops/deploy.sh user@your-server.com
```

## Airports Dataset

Import airport data from CSV:

```bash
# Download airports.csv (format: iata,name,city,country,tz)
go run ./backend/cmd/airports-load \
  "postgres://postgres:postgres@localhost:5432/deliverty?sslmode=disable" \
  ./ops/airports.csv
```

## MVP Checklist

See `ops/MVP_CHECKLIST.md` for complete readiness checklist.

## License

[Add your license here]
