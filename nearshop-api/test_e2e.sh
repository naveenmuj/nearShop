#!/bin/bash
BASE="http://localhost:8000/api/v1"
PASS=0
FAIL=0
RESULTS=""

log_result() {
    local status=$1 endpoint=$2 http_code=$3 desc=$4
    if [ "$status" = "PASS" ]; then
        echo "[PASS] $endpoint (HTTP $http_code) - $desc"
        PASS=$((PASS+1))
        RESULTS="$RESULTS\n[PASS]|$endpoint|$http_code|$desc"
    else
        echo "[FAIL] $endpoint (HTTP $http_code) - $desc"
        FAIL=$((FAIL+1))
        RESULTS="$RESULTS\n[FAIL]|$endpoint|$http_code|$desc"
    fi
}

check() {
    local endpoint=$1 expected=$2 http_code=$3 body=$4 desc=$5
    if [ "$http_code" -eq "$expected" ] 2>/dev/null; then
        log_result "PASS" "$endpoint" "$http_code" "$desc"
    else
        log_result "FAIL" "$endpoint" "$http_code" "$desc (expected $expected, body: $(echo "$body" | head -c 200))"
    fi
}

echo "============================================"
echo "  NearShop API End-to-End Test Suite"
echo "============================================"
echo ""

# Helper to switch role and capture new token
switch_role() {
    local role=$1
    local RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/switch-role -H "$AUTH" -H "Content-Type: application/json" -d "{\"role\":\"$role\"}")
    local BODY=$(echo "$RESP" | sed '$d')
    local NEW_TOKEN=$(echo "$BODY" | python -c "import sys,json; t=json.load(sys.stdin).get('access_token',''); print(t) if t else print('')" 2>/dev/null)
    if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "" ] && [ "$NEW_TOKEN" != "None" ]; then
        TOKEN="$NEW_TOKEN"
        AUTH="Authorization: Bearer $TOKEN"
    fi
}

# ===== 0. Health Check =====
echo "--- Health Check ---"
RESP=$(curl -s -w "\n%{http_code}" $BASE/health)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /health" 200 "$CODE" "$BODY" "Health check OK"

# ===== 1. AUTH =====
echo ""
echo "--- 1. Auth ---"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/send-otp -H "Content-Type: application/json" -d '{"phone":"+919876543210"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/send-otp" 200 "$CODE" "$BODY" "OTP sent"

OTP=$(python -c "
import asyncio, asyncpg
async def get_otp():
    conn = await asyncpg.connect(user='postgres', password='Winter#123', host='localhost', port=5432, database='nearshop', ssl=False)
    row = await conn.fetchrow(\"SELECT code FROM otp_codes WHERE phone=\$1 ORDER BY created_at DESC LIMIT 1\", '+919876543210')
    print(row['code'])
    await conn.close()
asyncio.run(get_otp())
" 2>/dev/null)
echo "  OTP from DB: $OTP"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/verify-otp -H "Content-Type: application/json" -d "{\"phone\":\"+919876543210\",\"code\":\"$OTP\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/verify-otp" 200 "$CODE" "$BODY" "OTP verified"
TOKEN=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
REFRESH=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('refresh_token',''))" 2>/dev/null)
AUTH="Authorization: Bearer $TOKEN"
echo "  Token: ${TOKEN:0:20}..."

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/complete-profile -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Test User","role":"business"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/complete-profile" 200 "$CODE" "$BODY" "Profile completed (business)"

RESP=$(curl -s -w "\n%{http_code}" $BASE/auth/me -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /auth/me" 200 "$CODE" "$BODY" "Got user profile"
USER_ID=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  User ID: $USER_ID"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/switch-role -H "$AUTH" -H "Content-Type: application/json" -d '{"role":"business"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/switch-role" 200 "$CODE" "$BODY" "Switched to business"
NEW_TOKEN=$(echo "$BODY" | python -c "import sys,json; t=json.load(sys.stdin).get('access_token',''); print(t) if t else print('')" 2>/dev/null)
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "None" ] && [ "$NEW_TOKEN" != "" ]; then TOKEN="$NEW_TOKEN"; AUTH="Authorization: Bearer $TOKEN"; fi

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/auth/refresh -H "Content-Type: application/json" -d "{\"refresh_token\":\"$REFRESH\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/refresh" 200 "$CODE" "$BODY" "Token refreshed"
NEW_TOKEN=$(echo "$BODY" | python -c "import sys,json; t=json.load(sys.stdin).get('access_token',''); print(t) if t else print('')" 2>/dev/null)
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "None" ] && [ "$NEW_TOKEN" != "" ]; then TOKEN="$NEW_TOKEN"; AUTH="Authorization: Bearer $TOKEN"; fi

# ===== 2. SHOPS =====
echo ""
echo "--- 2. Shops ---"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/shops/ -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Fresh Mart Koramangala","category":"grocery","phone":"+919876543211","latitude":12.9352,"longitude":77.6245,"address":"4th Block, Koramangala, Bangalore"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /shops/ [Shop 1]" 200 "$CODE" "$BODY" "Created Fresh Mart Koramangala"
SHOP1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Shop 1 ID: $SHOP1"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/shops/ -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Spice World Indiranagar","category":"grocery","phone":"+919876543212","latitude":12.9716,"longitude":77.6412,"address":"100 Feet Road, Indiranagar, Bangalore"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /shops/ [Shop 2]" 200 "$CODE" "$BODY" "Created Spice World Indiranagar"
SHOP2=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Shop 2 ID: $SHOP2"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/shops/ -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"QuickBite Bakery JP Nagar","category":"bakery","phone":"+919876543213","latitude":12.9100,"longitude":77.5850,"address":"15th Cross, JP Nagar, Bangalore"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /shops/ [Shop 3]" 200 "$CODE" "$BODY" "Created QuickBite Bakery JP Nagar"
SHOP3=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Shop 3 ID: $SHOP3"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/shops/nearby?lat=12.9352&lng=77.6245&radius_km=10")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
COUNT=$(echo "$BODY" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else d.get('total',len(d.get('items',[]))))" 2>/dev/null)
check "GET /shops/nearby" 200 "$CODE" "$BODY" "Found $COUNT shops nearby"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/shops/search?q=Fresh")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /shops/search?q=Fresh" 200 "$CODE" "$BODY" "Text search for shops"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/shops/$SHOP1")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /shops/{shop_id}" 200 "$CODE" "$BODY" "Got shop details"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/shops/$SHOP2/follow" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /shops/{id}/follow" 200 "$CODE" "$BODY" "Followed Shop 2"

RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/shops/$SHOP2/follow" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /shops/{id}/follow" 200 "$CODE" "$BODY" "Unfollowed Shop 2"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/shops/$SHOP1" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Fresh Mart Koramangala Updated"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /shops/{shop_id}" 200 "$CODE" "$BODY" "Updated Shop 1"

# ===== 3. PRODUCTS =====
echo ""
echo "--- 3. Products ---"

# shop_id as query param, images required
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/products/?shop_id=$SHOP1" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Basmati Rice 5kg","description":"Premium long grain basmati rice","price":450.00,"category":"grocery","images":["https://example.com/rice.jpg"]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/ Rice" 200 "$CODE" "$BODY" "Created Basmati Rice"
PROD1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Product 1 ID: $PROD1"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/products/?shop_id=$SHOP1" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Nandini Milk 1L","description":"Fresh toned milk","price":52.00,"category":"dairy","images":["https://example.com/milk.jpg"]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/ Milk" 200 "$CODE" "$BODY" "Created Nandini Milk"
PROD2=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Product 2 ID: $PROD2"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/products/?shop_id=$SHOP2" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Turmeric Powder 200g","description":"Pure organic turmeric powder","price":85.00,"category":"spices","images":["https://example.com/turmeric.jpg"]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/ Turmeric" 200 "$CODE" "$BODY" "Created Turmeric Powder"
PROD3=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Product 3 ID: $PROD3"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/products/?shop_id=$SHOP2" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Red Chilli Powder 100g","description":"Guntur red chilli powder","price":65.00,"category":"spices","images":["https://example.com/chilli.jpg"]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/ Chilli" 200 "$CODE" "$BODY" "Created Red Chilli Powder"
PROD4=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Product 4 ID: $PROD4"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/products/?shop_id=$SHOP3" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Sourdough Bread Loaf","description":"Freshly baked artisan sourdough bread","price":180.00,"category":"bakery","images":["https://example.com/bread.jpg"]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/ Bread" 200 "$CODE" "$BODY" "Created Sourdough Bread"
PROD5=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Product 5 ID: $PROD5"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/products/?shop_id=$SHOP3" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Chocolate Truffle Cake","description":"Rich chocolate truffle cake 500g","price":550.00,"category":"bakery","images":["https://example.com/cake.jpg"]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/ Cake" 200 "$CODE" "$BODY" "Created Chocolate Truffle Cake"
PROD6=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Product 6 ID: $PROD6"

# Search with query
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/search?q=rice")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/search?q=rice" 200 "$CODE" "$BODY" "Product search by query"

# Search with geo (lat/lng)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/search?lat=12.9352&lng=77.6245&radius_km=5")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/search [geo]" 200 "$CODE" "$BODY" "Product search with geo filter"

# Search with price filter
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/search?min_price=50&max_price=100")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/search [price]" 200 "$CODE" "$BODY" "Product search with price filter"

# Search with category filter
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/search?category=bakery")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/search [category]" 200 "$CODE" "$BODY" "Product search by category"

# Search with pagination (page/per_page)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/search?per_page=2&page=1")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/search [pagination]" 200 "$CODE" "$BODY" "Product search with pagination"

# Get product by ID
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/$PROD1")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/{id}" 200 "$CODE" "$BODY" "Got product details"

# Update product
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/products/$PROD1" -H "$AUTH" -H "Content-Type: application/json" -d '{"price":425.00}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /products/{id}" 200 "$CODE" "$BODY" "Updated product price"

# Similar products
RESP=$(curl -s -w "\n%{http_code}" "$BASE/products/$PROD3/similar")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/{id}/similar" 200 "$CODE" "$BODY" "Similar products"

# ===== 4. ORDERS =====
echo ""
echo "--- 4. Orders ---"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/orders/ -H "$AUTH" -H "Content-Type: application/json" -d "{\"shop_id\":\"$SHOP1\",\"items\":[{\"product_id\":\"$PROD1\",\"quantity\":2,\"price\":425.00},{\"product_id\":\"$PROD2\",\"quantity\":3,\"price\":52.00}]}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders/" 200 "$CODE" "$BODY" "Created order"
ORDER1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Order ID: $ORDER1"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/orders/$ORDER1/status" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"confirmed"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /orders/{id}/status [confirmed]" 200 "$CODE" "$BODY" "Order confirmed"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/orders/$ORDER1/status" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"preparing"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /orders/{id}/status [preparing]" 200 "$CODE" "$BODY" "Order preparing"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/orders/$ORDER1/status" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"ready"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /orders/{id}/status [ready]" 200 "$CODE" "$BODY" "Order ready"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/orders/$ORDER1/status" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"completed"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /orders/{id}/status [completed]" 200 "$CODE" "$BODY" "Order completed"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/orders/my" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /orders/my" 200 "$CODE" "$BODY" "Got my orders"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/orders/shop/$SHOP1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /orders/shop/{shop_id}" 200 "$CODE" "$BODY" "Got shop orders"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/orders/ -H "$AUTH" -H "Content-Type: application/json" -d "{\"shop_id\":\"$SHOP2\",\"items\":[{\"product_id\":\"$PROD3\",\"quantity\":1,\"price\":85.00}]}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
ORDER2=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/orders/$ORDER2/cancel" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders/{id}/cancel" 200 "$CODE" "$BODY" "Cancelled order"

# Now test availability toggle (after orders)
switch_role "business"
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/products/$PROD2/availability" -H "$AUTH" -H "Content-Type: application/json" -d '{}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /products/{id}/availability" 200 "$CODE" "$BODY" "Toggled product availability"

# ===== 5. REVIEWS =====
echo ""
echo "--- 5. Reviews ---"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/reviews/ -H "$AUTH" -H "Content-Type: application/json" -d "{\"shop_id\":\"$SHOP1\",\"rating\":5,\"comment\":\"Excellent shop with fresh products!\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reviews/" 200 "$CODE" "$BODY" "Created review for Shop 1"
REVIEW1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Review ID: $REVIEW1"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/reviews/ -H "$AUTH" -H "Content-Type: application/json" -d "{\"shop_id\":\"$SHOP2\",\"rating\":4,\"comment\":\"Great variety of spices\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reviews/ [Shop 2]" 200 "$CODE" "$BODY" "Created review for Shop 2"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/reviews/shop/$SHOP1")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /reviews/shop/{shop_id}" 200 "$CODE" "$BODY" "Got shop reviews"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/reviews/$REVIEW1/reply" -H "$AUTH" -H "Content-Type: application/json" -d '{"reply":"Thank you for the wonderful review!"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reviews/{id}/reply" 200 "$CODE" "$BODY" "Replied to review"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/reviews/my" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /reviews/my" 200 "$CODE" "$BODY" "Got my reviews"

# ===== 6. DEALS =====
echo ""
echo "--- 6. Deals ---"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/deals/?shop_id=$SHOP1" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"20% off on all groceries","description":"Weekend special","discount_pct":20,"duration_hours":48}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /deals/" 200 "$CODE" "$BODY" "Created deal"
DEAL1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Deal ID: $DEAL1"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/deals/?shop_id=$SHOP3" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"Buy 1 Get 1 Free Bread","description":"BOGO on breads","discount_pct":50,"duration_hours":24}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /deals/ Deal2" 200 "$CODE" "$BODY" "Created BOGO deal"
DEAL2=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" "$BASE/deals/shop/$SHOP1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /deals/shop/{shop_id}" 200 "$CODE" "$BODY" "Got shop deals"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/deals/nearby?lat=12.9352&lng=77.6245&radius_km=10")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /deals/nearby" 200 "$CODE" "$BODY" "Got nearby deals"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/deals/$DEAL1/claim" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /deals/{id}/claim" 200 "$CODE" "$BODY" "Claimed deal"

# ===== 7. STORIES =====
echo ""
echo "--- 7. Stories ---"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/stories/?shop_id=$SHOP1" -H "$AUTH" -H "Content-Type: application/json" -d '{"media_url":"https://example.com/images/fresh-produce.jpg","caption":"Fresh organic vegetables just arrived!"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /stories/" 200 "$CODE" "$BODY" "Created story"
STORY1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Story ID: $STORY1"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/stories/feed" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /stories/feed" 200 "$CODE" "$BODY" "Got stories feed"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/stories/$STORY1/view" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /stories/{id}/view" 200 "$CODE" "$BODY" "Viewed story"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/stories/discover?lat=12.9352&lng=77.6245" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /stories/discover" 200 "$CODE" "$BODY" "Discovered stories"

# ===== 8. WISHLISTS =====
echo ""
echo "--- 8. Wishlists ---"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/wishlists/$PROD1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /wishlists/{product_id}" 200 "$CODE" "$BODY" "Added to wishlist"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/wishlists/$PROD5" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /wishlists/{product_id} [2]" 200 "$CODE" "$BODY" "Added second to wishlist"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/wishlists/" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /wishlists/" 200 "$CODE" "$BODY" "Listed wishlist"

RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/wishlists/$PROD5" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /wishlists/{product_id}" 200 "$CODE" "$BODY" "Removed from wishlist"

# ===== 9. HAGGLE =====
echo ""
echo "--- 9. Haggle ---"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/haggle/start -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":\"$PROD6\",\"offer_amount\":400.00}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /haggle/start" 200 "$CODE" "$BODY" "Started haggle session"
HAGGLE1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Haggle ID: $HAGGLE1"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/haggle/$HAGGLE1/offer" -H "$AUTH" -H "Content-Type: application/json" -d '{"offer_amount":480.00}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /haggle/{id}/offer" 200 "$CODE" "$BODY" "Sent counter-offer"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/haggle/$HAGGLE1/accept" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /haggle/{id}/accept" 200 "$CODE" "$BODY" "Accepted haggle"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/haggle/my" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /haggle/my" 200 "$CODE" "$BODY" "Got my haggle sessions"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/haggle/shop/$SHOP3" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /haggle/shop/{shop_id}" 200 "$CODE" "$BODY" "Got shop haggle sessions"

# ===== 10. RESERVATIONS =====
echo ""
echo "--- 10. Reservations ---"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/reservations/ -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":\"$PROD5\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reservations/" 200 "$CODE" "$BODY" "Created reservation"
RESV1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Reservation 1 ID: $RESV1"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/reservations/ -H "$AUTH" -H "Content-Type: application/json" -d "{\"product_id\":\"$PROD6\"}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reservations/ [2]" 200 "$CODE" "$BODY" "Created second reservation"
RESV2=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Reservation 2 ID: $RESV2"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/reservations/my" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /reservations/my" 200 "$CODE" "$BODY" "Got my reservations"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/reservations/$RESV1/fulfill" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reservations/{id}/fulfill" 200 "$CODE" "$BODY" "Fulfilled reservation"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/reservations/$RESV2/no-show" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /reservations/{id}/no-show" 200 "$CODE" "$BODY" "Marked no-show"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/reservations/shop/$SHOP3" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /reservations/shop/{shop_id}" 200 "$CODE" "$BODY" "Got shop reservations"

# ===== 11. COMMUNITY =====
echo ""
echo "--- 11. Community ---"

switch_role "customer"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/community/posts -H "$AUTH" -H "Content-Type: application/json" -d '{"post_type":"question","title":"Where to find organic veggies in Koramangala?","body":"Looking for organic vegetables.","latitude":12.9352,"longitude":77.6245}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /community/posts [question]" 200 "$CODE" "$BODY" "Created question post"
POST1=$(echo "$BODY" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Post ID: $POST1"

RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/community/posts -H "$AUTH" -H "Content-Type: application/json" -d '{"post_type":"recommendation","title":"Amazing bakery in JP Nagar!","body":"QuickBite Bakery has the best sourdough.","latitude":12.9100,"longitude":77.5850}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /community/posts [recommendation]" 200 "$CODE" "$BODY" "Created recommendation"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/community/posts/$POST1/answers" -H "$AUTH" -H "Content-Type: application/json" -d '{"body":"Fresh Mart in 4th Block has great organic produce!"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /community/posts/{id}/answers" 200 "$CODE" "$BODY" "Answered question"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/community/posts/$POST1/upvote" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /community/posts/{id}/upvote" 200 "$CODE" "$BODY" "Upvoted post"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/community/posts/$POST1/resolve" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /community/posts/{id}/resolve" 200 "$CODE" "$BODY" "Resolved question"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/community/posts/$POST1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /community/posts/{id}" 200 "$CODE" "$BODY" "Got post with answers"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/community/feed" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /community/feed" 200 "$CODE" "$BODY" "Got community feed"

# ===== 12. LOYALTY =====
echo ""
echo "--- 12. Loyalty ---"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/loyalty/balance" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /loyalty/balance" 200 "$CODE" "$BODY" "Got loyalty balance"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/loyalty/leaderboard" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /loyalty/leaderboard" 200 "$CODE" "$BODY" "Got leaderboard"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/loyalty/badges" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /loyalty/badges" 200 "$CODE" "$BODY" "Got badges"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/loyalty/history" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /loyalty/history" 200 "$CODE" "$BODY" "Got loyalty history"

# ===== 13. NOTIFICATIONS =====
echo ""
echo "--- 13. Notifications ---"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/notifications/" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /notifications/" 200 "$CODE" "$BODY" "Listed notifications"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/notifications/unread-count" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /notifications/unread-count" 200 "$CODE" "$BODY" "Got unread count"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/notifications/read-all" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "PUT /notifications/read-all" 200 "$CODE" "$BODY" "Marked all as read"

# ===== 14. FEED =====
echo ""
echo "--- 14. Feed ---"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/feed/home?lat=12.9352&lng=77.6245" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /feed/home" 200 "$CODE" "$BODY" "Got home feed"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/feed/hook?lat=12.9352&lng=77.6245" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /feed/hook" 200 "$CODE" "$BODY" "Got feed hook"

# ===== 15. ANALYTICS =====
echo ""
echo "--- 15. Analytics ---"

switch_role "business"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/analytics/shop/$SHOP1/stats" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /analytics/shop/{id}/stats" 200 "$CODE" "$BODY" "Got shop stats"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/analytics/shop/$SHOP1/products" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /analytics/shop/{id}/products" 200 "$CODE" "$BODY" "Got product analytics"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/analytics/shop/$SHOP1/demand?lat=12.9352&lng=77.6245" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /analytics/shop/{id}/demand" 200 "$CODE" "$BODY" "Got demand insights"

# ===== 16. AI ENDPOINTS =====
echo ""
echo "--- 16. AI Endpoints ---"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/ai/catalog/snap" -H "$AUTH" -H "Content-Type: application/json" -d '{"image_url":"https://example.com/shelf.jpg"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" -lt 500 ]; then
    log_result "PASS" "POST /ai/catalog/snap" "$CODE" "Snap catalog (non-500)"
else
    log_result "FAIL" "POST /ai/catalog/snap" "$CODE" "Server error"
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/ai/catalog/shelf" -H "$AUTH" -H "Content-Type: application/json" -d '{"image_url":"https://example.com/shelf.jpg"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" -lt 500 ]; then
    log_result "PASS" "POST /ai/catalog/shelf" "$CODE" "Shelf catalog (non-500)"
else
    log_result "FAIL" "POST /ai/catalog/shelf" "$CODE" "Server error"
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/ai/search/visual" -H "$AUTH" -H "Content-Type: application/json" -d '{"image_url":"https://example.com/product.jpg","latitude":12.9352,"longitude":77.6245}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" -lt 500 ]; then
    log_result "PASS" "POST /ai/search/visual" "$CODE" "Visual search (non-500)"
else
    log_result "FAIL" "POST /ai/search/visual" "$CODE" "Server error"
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/ai/search/conversational" -H "$AUTH" -H "Content-Type: application/json" -d '{"query":"fresh vegetables near me","latitude":12.9352,"longitude":77.6245}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" -lt 500 ]; then
    log_result "PASS" "POST /ai/search/conversational" "$CODE" "Conversational search (non-500)"
else
    log_result "FAIL" "POST /ai/search/conversational" "$CODE" "Server error"
fi

RESP=$(curl -s -w "\n%{http_code}" "$BASE/ai/pricing/suggest/$PROD1?shop_id=$SHOP1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" -lt 500 ]; then
    log_result "PASS" "GET /ai/pricing/suggest/{id}" "$CODE" "Pricing suggest (non-500)"
else
    log_result "FAIL" "GET /ai/pricing/suggest/{id}" "$CODE" "Server error"
fi

RESP=$(curl -s -w "\n%{http_code}" "$BASE/ai/recommendations?lat=12.9352&lng=77.6245" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" -lt 500 ]; then
    log_result "PASS" "GET /ai/recommendations" "$CODE" "Recommendations (non-500)"
else
    log_result "FAIL" "GET /ai/recommendations" "$CODE" "Server error"
fi

# ===== CLEANUP: Delete tests =====
echo ""
echo "--- Cleanup/Delete Tests ---"

RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/products/$PROD4" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /products/{id}" 200 "$CODE" "$BODY" "Deleted product"

RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/stories/$STORY1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /stories/{id}" 200 "$CODE" "$BODY" "Deleted story"

RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/deals/$DEAL1" -H "$AUTH")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /deals/{id}" 200 "$CODE" "$BODY" "Deleted deal"

# ===== SUMMARY =====
echo ""
echo "============================================"
echo "         TEST RESULTS SUMMARY"
echo "============================================"
echo ""
TOTAL=$((PASS+FAIL))
echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL"
echo ""
printf "%-8s | %-45s | %-4s | %s\n" "Status" "Endpoint" "HTTP" "Description"
printf "%-8s-+-%-45s-+-%-4s-+-%s\n" "--------" "---------------------------------------------" "----" "-------------------------------------------"
echo -e "$RESULTS" | while IFS='|' read status endpoint code desc; do
    [ -z "$status" ] && continue
    printf "%-8s | %-45s | %-4s | %s\n" "$status" "$endpoint" "$code" "$desc"
done
echo ""
echo "============================================"
if [ "$FAIL" -eq 0 ]; then
    echo "  ALL TESTS PASSED!"
else
    echo "  $FAIL TEST(S) FAILED"
fi
echo "============================================"
