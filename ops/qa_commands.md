# QA Test Commands

End-to-end testing commands for the Deliverty API.

## Setup

```bash
# Set base URL and test Telegram user IDs
export API=http://localhost:8080/api
export TG=111222333        # Test Telegram user ID 1 (request sender)
export TG2=999888777       # Test Telegram user ID 2 (trip courier)

# Helper alias for headers
alias H='-H "Content-Type: application/json" -H "X-TG-User-ID: '"$TG"'"'
```

## Test Steps

### 1. Create REQUEST (BKK→HKT, 7-day window)

```bash
curl -s $API/publications $H -d '{
  "kind":"request",
  "from_iata":"BKK",
  "to_iata":"HKT",
  "date_start":"2025-11-10",
  "date_end":"2025-11-16",
  "item":"documents",
  "weight":"envelope",
  "description":"Passport envelope"
}'
```

**Response:** `{"id":1}` - Save the ID as `REQ_ID`

### 2. Create TRIP (other TG user)

```bash
REQ_ID=1  # Replace with ID from step 1

curl -s $API/publications \
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
  }'
```

**Response:** `{"id":2}` - Save the ID as `TRIP_ID`

### 3. Find matches for REQUEST

```bash
REQ_ID=1  # Replace with ID from step 1

curl -s "$API/matches?pub_id=$REQ_ID" -H "X-TG-User-ID: $TG"
```

**Expected:** Array of matching trips with scores

### 4. Create deal

```bash
REQ_ID=1   # Replace with ID from step 1
TRIP_ID=2  # Replace with ID from step 2

curl -s $API/deals $H -d '{
  "request_pub_id":'"$REQ_ID"',
  "trip_pub_id":'"$TRIP_ID"'
}'
```

**Response:** `{"id":1}` - Save as `DEAL_ID`

### 5. Get deep-link

```bash
DEAL_ID=1  # Replace with ID from step 4

curl -s "$API/deals/$DEAL_ID/deep-link" -H "X-TG-User-ID: $TG"
```

**Response:** `{"url":"https://t.me/botname?start=deal:1:signature"}`

### 6. Update status → agreed

```bash
DEAL_ID=1  # Replace with ID from step 4

curl -s -X POST "$API/deals/$DEAL_ID/status" $H -d '{"status":"agreed"}'
```

**Response:** `{"ok":true}`

### 7. Update status → handoff_done

```bash
DEAL_ID=1  # Replace with ID from step 4

curl -s -X POST "$API/deals/$DEAL_ID/status" $H -d '{"status":"handoff_done"}'
```

**Response:** `{"ok":true}`

### 8. Rate counterpart (+1)

```bash
DEAL_ID=1  # Replace with ID from step 4

curl -s -X POST "$API/deals/$DEAL_ID/rate" $H -d '{"score":1}'
```

**Response:** `{"ok":true}`

### 9. Cancel deal (optional)

```bash
DEAL_ID=1  # Replace with ID from step 4

curl -s -X POST "$API/deals/$DEAL_ID/status" $H -d '{"status":"cancelled"}'
```

## Additional Tests

### Airport Search

```bash
curl -s "$API/airports?q=bkk"
```

### List Publications

```bash
curl -s "$API/publications?from=BKK&to=HKT" -H "X-TG-User-ID: $TG"
```

### List Publications (filtered by kind)

```bash
curl -s "$API/publications?from=BKK&to=HKT&kind=request" -H "X-TG-User-ID: $TG"
```

### Health Check

```bash
curl -s http://localhost:8080/healthz
```

## Error Cases

### Missing required field

```bash
curl -s $API/publications $H -d '{
  "kind":"request",
  "from_iata":"BKK"
}'
```

**Expected:** `{"error":"bad json"}`

### Duplicate publication (within 1 hour)

```bash
# Run step 1 twice with same data
curl -s $API/publications $H -d '{
  "kind":"request",
  "from_iata":"BKK",
  "to_iata":"HKT",
  "date_start":"2025-11-10",
  "date_end":"2025-11-16",
  "item":"documents",
  "weight":"envelope",
  "description":"Passport envelope"
}'
```

**Expected:** `{"error":"duplicate too soon"}`

### Banned item in description

```bash
curl -s $API/publications $H -d '{
  "kind":"request",
  "from_iata":"BKK",
  "to_iata":"HKT",
  "date_start":"2025-11-10",
  "date_end":"2025-11-16",
  "item":"documents",
  "weight":"envelope",
  "description":"Need to transport weapons"
}'
```

**Expected:** `{"error":"item not permitted by policy"}`

### Contacts in description

```bash
curl -s $API/publications $H -d '{
  "kind":"request",
  "from_iata":"BKK",
  "to_iata":"HKT",
  "date_start":"2025-11-10",
  "date_end":"2025-11-16",
  "item":"documents",
  "weight":"envelope",
  "description":"Contact me at +1234567890"
}'
```

**Expected:** `{"error":"contacts not allowed in description"}`

### Invalid date window (>14 days)

```bash
curl -s $API/publications $H -d '{
  "kind":"request",
  "from_iata":"BKK",
  "to_iata":"HKT",
  "date_start":"2025-11-10",
  "date_end":"2025-12-10",
  "item":"documents",
  "weight":"envelope",
  "description":"Test"
}'
```

**Expected:** `{"error":"date window must be 1–14 days"}`

### Rate limit test (20 requests)

```bash
# Run 21 times quickly
for i in {1..21}; do
  curl -s $API/publications $H -d '{
    "kind":"request",
    "from_iata":"BKK",
    "to_iata":"HKT",
    "date_start":"2025-11-10",
    "date_end":"2025-11-16",
    "item":"documents",
    "weight":"envelope",
    "description":"Test"
  }'
  echo ""
done
```

**Expected:** 20 successful, 21st returns `{"error":"rate limit"}`

## Running Full Test Suite

Use the automated script:

```bash
cd ops
./qa_test.sh
```

Or with custom values:

```bash
API=http://localhost:8080/api TG=111222333 TG2=999888777 ./qa_test.sh
```





