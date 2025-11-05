#!/bin/bash
# End-to-end QA test script for Deliverty API
# Usage: ./qa_test.sh

set -e

# Configuration
API="${API:-http://localhost:8080/api}"
TG="${TG:-111222333}"        # Test Telegram user ID 1 (request sender)
TG2="${TG2:-999888777}"      # Test Telegram user ID 2 (trip courier)

# Helper function for headers
H() {
  echo '-H "Content-Type: application/json" -H "X-TG-User-ID: '"$TG"'"'
}

echo "=== Deliverty API E2E Test ==="
echo "API: $API"
echo "TG User 1: $TG (Request sender)"
echo "TG User 2: $TG2 (Trip courier)"
echo ""

# Step 1: Create REQUEST (BKK→HKT, 7-day window)
echo "1. Creating REQUEST publication..."
REQ_RESPONSE=$(curl -s "$API/publications" \
  -H "Content-Type: application/json" \
  -H "X-TG-User-ID: $TG" \
  -d '{
    "kind":"request",
    "from_iata":"BKK",
    "to_iata":"HKT",
    "date_start":"2025-11-10",
    "date_end":"2025-11-16",
    "item":"documents",
    "weight":"envelope",
    "description":"Passport envelope"
  }')

echo "Response: $REQ_RESPONSE"
REQ_ID=$(echo $REQ_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
echo "Request ID: $REQ_ID"
echo ""

if [ -z "$REQ_ID" ]; then
  echo "ERROR: Failed to create request publication"
  exit 1
fi

# Step 2: Create TRIP (other TG user)
echo "2. Creating TRIP publication..."
TRIP_RESPONSE=$(curl -s "$API/publications" \
  -H "Content-Type: application/json" \
  -H "X-TG-User-ID: $TG2" \
  -d '{
    "kind":"trip",
    "from_iata":"BKK",
    "to_iata":"HKT",
    "date_start":"2025-11-12",
    "date_end":"2025-11-14",
    "item":"documents",
    "weight":"le1kg",
    "flight_no":"TG201",
    "airline":"Thai Airways",
    "description":"Hand luggage ok"
  }')

echo "Response: $TRIP_RESPONSE"
TRIP_ID=$(echo $TRIP_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
echo "Trip ID: $TRIP_ID"
echo ""

if [ -z "$TRIP_ID" ]; then
  echo "ERROR: Failed to create trip publication"
  exit 1
fi

# Step 3: Find matches for REQUEST
echo "3. Finding matches for REQUEST $REQ_ID..."
MATCHES_RESPONSE=$(curl -s "$API/matches?pub_id=$REQ_ID" \
  -H "X-TG-User-ID: $TG")
echo "Response: $MATCHES_RESPONSE"
echo ""

# Step 4: Create deal
echo "4. Creating deal (REQUEST $REQ_ID + TRIP $TRIP_ID)..."
DEAL_RESPONSE=$(curl -s "$API/deals" \
  -H "Content-Type: application/json" \
  -H "X-TG-User-ID: $TG" \
  -d '{
    "request_pub_id":'"$REQ_ID"',
    "trip_pub_id":'"$TRIP_ID"'
  }')

echo "Response: $DEAL_RESPONSE"
DEAL_ID=$(echo $DEAL_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
echo "Deal ID: $DEAL_ID"
echo ""

if [ -z "$DEAL_ID" ]; then
  echo "ERROR: Failed to create deal"
  exit 1
fi

# Step 5: Get deep-link
echo "5. Getting deep-link for DEAL $DEAL_ID..."
DEEPLINK_RESPONSE=$(curl -s "$API/deals/$DEAL_ID/deep-link" \
  -H "X-TG-User-ID: $TG")
echo "Response: $DEEPLINK_RESPONSE"
echo ""

# Step 6: Update status → agreed
echo "6. Updating deal status to 'agreed'..."
STATUS_RESPONSE=$(curl -s -X POST "$API/deals/$DEAL_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-TG-User-ID: $TG" \
  -d '{"status":"agreed"}')
echo "Response: $STATUS_RESPONSE"
echo ""

# Step 7: Update status → handoff_done
echo "7. Updating deal status to 'handoff_done'..."
STATUS_RESPONSE=$(curl -s -X POST "$API/deals/$DEAL_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-TG-User-ID: $TG" \
  -d '{"status":"handoff_done"}')
echo "Response: $STATUS_RESPONSE"
echo ""

# Step 8: Rate counterpart (+1)
echo "8. Rating counterpart (+1)..."
RATE_RESPONSE=$(curl -s -X POST "$API/deals/$DEAL_ID/rate" \
  -H "Content-Type: application/json" \
  -H "X-TG-User-ID: $TG" \
  -d '{"score":1}')
echo "Response: $RATE_RESPONSE"
echo ""

# Additional: Test airport search
echo "9. Testing airport search..."
AIRPORT_RESPONSE=$(curl -s "$API/airports?q=bkk")
echo "Response: $AIRPORT_RESPONSE"
echo ""

# Additional: List publications
echo "10. Listing publications (BKK→HKT)..."
LIST_RESPONSE=$(curl -s "$API/publications?from=BKK&to=HKT" \
  -H "X-TG-User-ID: $TG")
echo "Response: $LIST_RESPONSE"
echo ""

echo "=== E2E Test Complete ==="
echo "Created:"
echo "  - Request ID: $REQ_ID"
echo "  - Trip ID: $TRIP_ID"
echo "  - Deal ID: $DEAL_ID"

