# WebSocket Message Format Reference

## Overview

This document defines the exact message formats exchanged between client and server over WebSocket connections for order tracking.

---

## Customer Order Tracking (Consumer Perspective)

### WebSocket Connection
```
URL: ws://api.nearshop.local/api/v1/orders/ws/track/{order_id}?token={jwt_token}

Connection Headers:
  Authorization: Bearer {jwt_token}
  Origin: https://app.nearshop.local
  Upgrade: websocket
  Connection: Upgrade
```

### Message 1: Initial Connection

**Sent by**: Server
**When**: Immediately after WebSocket connects
**Purpose**: Confirm connection and send initial order state

```json
{
  "type": "connected",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_number": "ORD-2026-00012345",
  "status": "pending",
  "payment_status": "paid",
  "created_at": "2026-04-15T09:45:30.123456Z"
}
```

**Fields**:
- `type` (string): Always "connected" for this message
- `order_id` (UUID): Unique order identifier
- `order_number` (string): Human-readable order reference
- `status` (enum): Current order status
  - `"pending"` - Awaiting acceptance
  - `"confirmed"` - Accepted by shop
  - `"preparing"` - Being prepared
  - `"ready"` - Ready for pickup/delivery
  - `"completed"` - Order fulfilled
  - `"cancelled"` - Order cancelled
- `payment_status` (enum): Payment state
  - `"pending"` - Not yet processed
  - `"paid"` - Successfully paid
  - `"refunded"` - Money returned
- `created_at` (ISO8601): When order was placed

**UI Action in App**:
```javascript
// nearshop-mobile/app/(customer)/order-tracking/[id].jsx
onOpen: () => {
  setWsConnected(true)  // Show "LIVE" indicator
  reconnectCountRef.current = 0  // Reset retry count
}
```

---

### Message 2: Order Status Update

**Sent by**: Server (broadcast to all tracking this order)
**When**: Order status changes on business side
**Purpose**: Notify customer of order progress

```json
{
  "type": "status_update",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_number": "ORD-2026-00012345",
  "status": "confirmed",
  "timestamp": "2026-04-15T09:48:15.654321Z",
  "description": "Order confirmed by shop"
}
```

**Fields**:
- `type` (string): Always "status_update"
- `order_id` (UUID): Which order changed
- `order_number` (string): For display
- `status` (enum): New status (same values as above)
- `timestamp` (ISO8601): When status changed
- `description` (string): Optional human-readable description

**UI Action in App**:
```javascript
// nearshop-mobile/app/(customer)/order-tracking/[id].jsx
onMessage: (data) => {
  if (data.type === 'status_update') {
    setLiveUpdate(data)  // Flash "LIVE" indicator
    setTracking((prev) => {
      const newTimeline = [...(prev.timeline || [])]
      newTimeline.push({
        status: data.status,
        timestamp: data.timestamp,
        description: data.description
      })
      return {
        ...prev,
        current_status: data.status,
        timeline: newTimeline
      }
    })
    // Clear highlight after 3 seconds
    if (liveUpdateTimeoutRef.current) {
      clearTimeout(liveUpdateTimeoutRef.current)
    }
    liveUpdateTimeoutRef.current = setTimeout(
      () => setLiveUpdate(null),
      3000
    )
  }
}
```

---

### Message 3: Heartbeat (Keep-Alive)

**Sent by**: Server
**When**: Every 30 seconds of inactivity
**Purpose**: Keep WebSocket connection alive, detect dead connections

```json
{
  "type": "heartbeat"
}
```

**Fields**:
- `type` (string): Always "heartbeat"

**UI Action in App**:
```javascript
onMessage: (data) => {
  if (data.type === 'heartbeat') {
    // No action needed, just keep connection open
    // App continues to show "LIVE" indicator
  }
}
```

**Timeline**:
- Server sends heartbeat after 30 seconds of no messages
- If no heartbeat received for 60+ seconds, likely connection is dead
- App attempts reconnection

---

### Message 4: Pong (Ping Response)

**Sent by**: Server
**When**: In response to client "ping" message
**Purpose**: Confirm connection is alive

```json
{
  "type": "pong"
}
```

**Fields**:
- `type` (string): Always "pong"

**Triggered by Client**:
```javascript
// App sends ping to keep connection fresh
ws.send('ping')
// Server responds with:
// {"type": "pong"}
```

---

### Message 5: Error (Server-side Error)

**Sent by**: Server
**When**: Unexpected error on server
**Purpose**: Notify client of error condition

```json
{
  "type": "error",
  "message": "Database connection lost",
  "code": "DB_ERROR"
}
```

**Fields**:
- `type` (string): Always "error"
- `message` (string): Human-readable error message
- `code` (string): Error category code

**UI Action in App**:
```javascript
onError: (error) => {
  setWsConnected(false)
  scheduleReconnect()  // Attempt to reconnect
}
```

---

## Business Shop Orders (Merchant Perspective)

### WebSocket Connection
```
URL: ws://api.nearshop.local/api/v1/orders/ws/shop/{shop_id}?token={jwt_token}

Connection Headers:
  Authorization: Bearer {jwt_token}
  Origin: https://merchant.nearshop.local
  Upgrade: websocket
  Connection: Upgrade
```

### Message 1: Initial Connection

**Sent by**: Server
**When**: Immediately after WebSocket connects
**Purpose**: Confirm merchant connection and send shop info

```json
{
  "type": "connected",
  "shop_id": "660e8400-e29b-41d4-a716-446655440002",
  "shop_name": "Fresh Juice Bar"
}
```

**Fields**:
- `type` (string): Always "connected"
- `shop_id` (UUID): Unique shop identifier
- `shop_name` (string): Shop display name

**UI Action in App**:
```javascript
// nearshop-mobile/app/(business)/orders.jsx
onOpen: () => {
  setWsConnected(true)  // Could show in header
  reconnectCountRef.current = 0
}
```

---

### Message 2: Order Status Update (New or Changed)

**Sent by**: Server (broadcast to shop owner)
**When**: 
  - New order is placed for this shop (status: "pending")
  - Any existing order status changes (confirmed/preparing/ready/completed)
**Purpose**: Notify merchant of new orders and status changes

```json
{
  "type": "status_update",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_number": "ORD-2026-00012345",
  "status": "pending",
  "timestamp": "2026-04-15T09:45:30.123456Z"
}
```

**or for status change:**

```json
{
  "type": "status_update",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_number": "ORD-2026-00012345",
  "status": "confirmed",
  "timestamp": "2026-04-15T09:48:15.654321Z"
}
```

**Fields**:
- `type` (string): Always "status_update"
- `order_id` (UUID): Which order
- `order_number` (string): Display reference
- `status` (enum): Current order status
- `timestamp` (ISO8601): When order was created or status changed

**UI Action in App**:
```javascript
// nearshop-mobile/app/(business)/orders.jsx

// For new order:
if (data.status === 'pending') {
  // Add to orders list
  setOrders((prev) => [
    {
      id: data.order_id,
      order_number: data.order_number,
      status: data.status,
      created_at: data.timestamp,
      // ... other fields from REST API
    },
    ...prev
  ])
}

// For status update on existing order:
setOrders((prev) =>
  prev.map((order) =>
    order.id === data.order_id
      ? { ...order, status: data.status }
      : order
  )
)
```

---

### Message 3: New Order Notification

**Sent by**: Server
**When**: New order placed (alternative to status_update with status=pending)
**Purpose**: Special notification for new orders

```json
{
  "type": "new_order",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_number": "ORD-2026-00012345",
  "customer_name": "John Doe",
  "items_count": 3,
  "total_amount": 450.50,
  "timestamp": "2026-04-15T09:45:30.123456Z"
}
```

**Fields**:
- `type` (string): Always "new_order"
- `order_id` (UUID): New order identifier
- `order_number` (string): Display reference
- `customer_name` (string): Name of customer
- `items_count` (integer): Number of items in order
- `total_amount` (decimal): Total order value
- `timestamp` (ISO8601): When order was placed

**UI Action in App**:
```javascript
onMessage: (data) => {
  if (data.type === 'new_order') {
    // Show notification/badge
    showNotification(`New Order: ${data.order_number}`)
    
    // Add to orders list
    setOrders((prev) => [
      {
        id: data.order_id,
        order_number: data.order_number,
        customer_name: data.customer_name,
        status: 'pending',
        created_at: data.timestamp,
        items_count: data.items_count,
        total_amount: data.total_amount
      },
      ...prev
    ])
  }
}
```

---

### Message 4: Heartbeat

**Sent by**: Server
**When**: Every 30 seconds of inactivity
**Purpose**: Keep WebSocket connection alive

```json
{
  "type": "heartbeat"
}
```

**Same as customer side - no action needed**

---

### Message 5: Pong

**Sent by**: Server
**When**: In response to merchant "ping"
**Purpose**: Confirm connection is alive

```json
{
  "type": "pong"
}
```

**Same as customer side**

---

## Client-to-Server Messages

### Ping (Keep-Alive Request)

**Sent by**: Client (both customer and business)
**When**: Periodically to keep connection alive
**Purpose**: Detect dead connections early

```
Message: "ping"
Response: {"type": "pong"}
```

---

## Error Scenarios

### Scenario 1: Invalid Token

**Request**:
```
ws://api.nearshop.local/api/v1/orders/ws/track/550e8400-e29b-41d4-a716-446655440001?token=invalid_token
```

**Response**:
```
WebSocket Close Frame
Code: 4001
Reason: "Invalid token"
```

**Client Action**:
```javascript
onError: (error) => {
  console.error("Token invalid, must re-authenticate")
  router.push('/login')
}
```

---

### Scenario 2: Unauthorized Order

**Request**:
```
ws://api.nearshop.local/api/v1/orders/ws/track/550e8400-e29b-41d4-a716-446655440001?token=valid_token
// But user doesn't own this order and isn't the shop owner
```

**Response**:
```
WebSocket Close Frame
Code: 4003
Reason: "Not authorized"
```

**Client Action**:
```javascript
onError: (error) => {
  console.error("Not authorized to view this order")
  router.push('/(customer)/orders')
}
```

---

### Scenario 3: Order Not Found

**Request**:
```
ws://api.nearshop.local/api/v1/orders/ws/track/00000000-0000-0000-0000-000000000000?token=valid_token
```

**Response**:
```
WebSocket Close Frame
Code: 4004
Reason: "Order not found"
```

**Client Action**:
```javascript
onError: (error) => {
  console.error("Order no longer exists")
  router.push('/(customer)/orders')
}
```

---

### Scenario 4: Shop Not Authorized

**Request**:
```
ws://api.nearshop.local/api/v1/orders/ws/shop/660e8400-e29b-41d4-a716-446655440002?token=valid_token
// But user doesn't own this shop
```

**Response**:
```
WebSocket Close Frame
Code: 4003
Reason: "Not authorized"
```

**Client Action**:
```javascript
onError: (error) => {
  console.error("Not authorized to manage this shop")
  router.push('/(business)/dashboard')
}
```

---

## Reconnection Logic

When client receives `onError` or `onClose`:

```javascript
// Current state
reconnectCountRef.current = 0

// First disconnect
// Wait: 1000ms (1 second)
// Attempt reconnect → timeout or error
reconnectCountRef.current = 1

// Wait: 2000ms (2 seconds)
// Attempt reconnect → timeout or error
reconnectCountRef.current = 2

// Wait: 4000ms (4 seconds)
// Attempt reconnect → timeout or error
reconnectCountRef.current = 3

// Wait: 8000ms (8 seconds)
// Attempt reconnect → timeout or error
reconnectCountRef.current = 4

// Wait: 16000ms (16 seconds)
// Attempt reconnect → successful!
reconnectCountRef.current = 0  // Reset on success

// LIVE indicator returns
```

**Exponential Backoff Formula**:
```
delay = baseDelay * Math.pow(2, reconnectCount)
baseDelay = 1000 (1 second)
maxAttempts = 5
```

---

## Cleanup on Disconnect

```javascript
useEffect(() => {
  // ... connection code ...
  
  return () => {
    // Clear all timeouts
    if (liveUpdateTimeoutRef.current) {
      clearTimeout(liveUpdateTimeoutRef.current)
      liveUpdateTimeoutRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }
}, [id, token])
```

---

## Performance Characteristics

| Metric | Target | Reality |
|--------|--------|---------|
| Initial Connection | <2s | Typically 0.5-1.5s |
| Message Delivery | <1s | Typically 100-500ms |
| Heartbeat Interval | 30s | Exactly 30s |
| Reconnection Delay | 1-16s | Exponential backoff |
| Max Reconnect Attempts | 5 | Hardcoded limit |
| Message Queue Size | Unlimited | No queuing (live only) |
| Memory per Connection | ~50KB | Active WebSocket + buffers |

---

## Testing with WebSocket Inspector

### Browser DevTools Method

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Connect to order tracking
5. Click on the WebSocket connection
6. View "Messages" tab
7. See all frames sent/received with timestamps

**Example Frame**:
```
[09:48:15.654] ← {"type":"status_update","order_id":"550e8400-e29b-41d4-a716-446655440001","status":"confirmed","timestamp":"2026-04-15T09:48:15.654321Z"}
```

### Manual Test Command

```bash
# Test with curl + websocat
websocat "ws://localhost:8000/api/v1/orders/ws/track/550e8400-e29b-41d4-a716-446655440001?token=YOUR_JWT_TOKEN"

# You should see:
# {"type":"connected","order_id":"550e8400-e29b-41d4-a716-446655440001","status":"pending"...}

# Send ping:
# > ping
# < {"type":"pong"}
```

---

## Debugging Common Issues

### Issue: Messages not appearing

1. Check WebSocket connected:
   ```javascript
   wsConnected === true  // Should be true
   ```

2. Check token valid:
   ```
   Network → WebSocket → check ?token=... parameter
   ```

3. Check message type:
   ```
   DevTools → Network → WS → Messages
   Look for: {"type":"status_update"...}
   ```

4. Check onMessage handler:
   ```javascript
   if (data.type === 'status_update' || data.type === 'order_update')
   ```

### Issue: Connection keeps dropping

1. Check heartbeat working:
   ```
   DevTools → Network → WS → Messages
   Should see {"type":"heartbeat"} every 30s
   ```

2. Check reconnection logic:
   ```javascript
   onError: () => {
     setWsConnected(false)
     scheduleReconnect()  // Must be called
   }
   ```

3. Check token expiration:
   ```
   Token expires after 24 hours
   Must log out and log in again
   ```

---

**Last Updated**: 2026-04-15
**Status**: ✅ Ready for Testing
