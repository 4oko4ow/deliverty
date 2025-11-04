#!/bin/bash
# Script to setup Telegram bot webhook
# Usage: ./ops/setup_webhook.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🤖 Telegram Bot Webhook Setup"
echo ""

# Check if TG_BOT_TOKEN is set
if [ -z "$TG_BOT_TOKEN" ]; then
    echo -e "${RED}❌ Error: TG_BOT_TOKEN environment variable is not set${NC}"
    echo ""
    echo "Please set it first:"
    echo "  export TG_BOT_TOKEN=your-bot-token-here"
    echo ""
    exit 1
fi

# Check if BACKEND_URL is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  No backend URL provided${NC}"
    echo ""
    echo "Usage: $0 <BACKEND_URL>"
    echo ""
    echo "Example:"
    echo "  $0 https://deliverty-api.onrender.com"
    echo "  $0 https://your-domain.com"
    echo ""
    exit 1
fi

BACKEND_URL="$1"
WEBHOOK_URL="${BACKEND_URL}/bot/webhook"

echo "Bot Token: ${TG_BOT_TOKEN:0:10}... (hidden)"
echo "Webhook URL: ${WEBHOOK_URL}"
echo ""

# Set webhook
echo "Setting webhook..."
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"${WEBHOOK_URL}\"}")

if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Webhook set successfully!${NC}"
else
    echo -e "${RED}❌ Failed to set webhook${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "Verifying webhook..."

# Get webhook info
INFO=$(curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/getWebhookInfo")

if echo "$INFO" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Webhook info retrieved${NC}"
    echo ""
    echo "$INFO" | python3 -m json.tool 2>/dev/null || echo "$INFO"
else
    echo -e "${YELLOW}⚠️  Could not verify webhook info${NC}"
    echo "Response: $INFO"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Your bot is now configured to receive updates at:"
echo "  ${WEBHOOK_URL}"
echo ""
echo "Test it by sending /start to your bot in Telegram!"

