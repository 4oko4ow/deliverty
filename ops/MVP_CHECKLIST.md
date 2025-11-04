# MVP Readiness Checklist

## Database & Migrations

- [ ] Migrations 001-004 applied
  - [ ] `001_init.sql` - Core schema (users, publications, matches, deals)
  - [ ] `002_airports.sql` - Airport table and constraints
  - [ ] `003_rating_log.sql` - Rating log table
  - [ ] `004_reminders.sql` - Reminder log table
- [ ] Airports seeded (minimal or full dataset)
  - Run: `go run ./backend/cmd/airports-load <DATABASE_URL> <airports.csv>`

## API Endpoints

- [ ] `/healthz` - Health check endpoint
- [ ] `/api/airports?q=search` - Airport search (no auth)
- [ ] `/api/publications` (POST) - Create publication (auth required)
- [ ] `/api/publications` (GET) - List publications (auth required)
- [ ] `/api/matches?pub_id=123` - Find matches (auth required)
- [ ] `/api/deals` (POST) - Create deal (auth required)
- [ ] `/api/deals/:id/deep-link` (GET) - Get signed Telegram link (auth required)
- [ ] `/api/deals/:id/status` (POST) - Update deal status (auth required)
- [ ] `/api/deals/:id/rate` (POST) - Rate counterpart (auth required)
- [ ] `/bot/webhook` (POST) - Telegram bot webhook (no auth)

## Telegram Bot

- [ ] Bot created via @BotFather
- [ ] `TG_BOT_TOKEN` configured in environment
- [ ] `TG_BOT_NAME` configured (username without @)
- [ ] `TG_DEEPLINK_SECRET` set (random long string)
- [ ] Webhook configured: `curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" -d '{"url":"https://your-domain.com/bot/webhook"}'`
- [ ] Deep-link generation working
- [ ] Commands working: `/agree`, `/done`, `/cancel`
- [ ] Message relay working between participants

## Guards & Validation

- [ ] Contact filtering (regex blocks phone/@/URLs in descriptions)
- [ ] Banned items check (weapons, drugs, etc.)
- [ ] Description length limit (≤500 chars)
- [ ] Date window validation (1-14 days)
- [ ] Active publications limit (≤5 per user)
- [ ] Duplicate spam prevention (same pub within 1 hour)
- [ ] IP-based rate limiting
  - Global: 120/min
  - Airports: 240/min
  - Create publication: 20/min

## Background Services

- [ ] Reminders ticker running (5-minute intervals)
- [ ] Pre-flight reminders (T-24h, T-3h)
- [ ] Rating reminders after `/done`

## Frontend

- [ ] React app builds successfully
- [ ] Publish page working (create request/trip)
- [ ] Browse page working (search publications)
- [ ] Matches page working (view matches, create deal)
- [ ] Deep-link opens Telegram bot correctly
- [ ] Environment variables configured (`VITE_API_BASE`, `VITE_TG_BOT`)
- [ ] Content policy footer visible

## Testing

- [ ] QA script passes: `./ops/qa_test.sh`
- [ ] Manual curl tests work (see `ops/qa_commands.md`)
- [ ] Error cases tested (banned items, duplicates, rate limits)
- [ ] End-to-end flow works: publish → match → deal → Telegram

## Production Deployment (Optional)

- [ ] Nginx configured (SSL, reverse proxy)
- [ ] Systemd service configured
- [ ] Environment variables set in systemd service
- [ ] API binary deployed and executable
- [ ] Frontend built and deployed
- [ ] Service starts automatically on boot
- [ ] Logs accessible via `journalctl -u deliverty-api`

## Security

- [ ] All sensitive env vars set (not in code)
- [ ] Database credentials secure
- [ ] Bot token secure
- [ ] Deep-link secret secure
- [ ] CORS configured appropriately
- [ ] Rate limiting active

## Monitoring

- [ ] Health check endpoint accessible
- [ ] Basic error logging working
- [ ] Database connection pool healthy

---

## Quick Verification Commands

```bash
# Health check
curl http://localhost:8080/healthz

# Airport search
curl "http://localhost:8080/api/airports?q=bkk"

# Run full QA test
cd ops && ./qa_test.sh

# Check service status (production)
sudo systemctl status deliverty-api

# View logs (production)
sudo journalctl -u deliverty-api -f
```

## Ready for MVP Launch

Once all items are checked, the platform is ready for MVP launch! 🚀
