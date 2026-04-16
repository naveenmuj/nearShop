# WebSocket Integration Testing Guide

## Overview
This document provides comprehensive testing procedures for the WebSocket real-time messaging between:
1. **Customer Side**: Order tracking (customer receives live order updates)
2. **Business Side**: Shop orders (merchant receives new orders and updates)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Order Manager (order_tracking_manager)                   │  │
│  │  - Tracks active WebSocket connections                   │  │
│  │  - Broadcasts messages to connected clients              │  │
│  │  - Manages customer tracking rooms (per order_id)        │  │
│  │  - Manages shop order rooms (per shop_id)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▲                                       │
│                           │                                       │
│  ┌────────────────────────┼────────────────────────────────┐   │
│  │                        │                                 │   │
│  │  ┌─────────────────┐   │  ┌───────────────────────┐    │   │
│  │  │ /ws/track/...   │   │  │ /ws/shop/...          │    │   │
│  │  │ (customer side) │   │  │ (business side)       │    │   │
│  │  └─────────────────┘   │  └───────────────────────┘    │   │
│  │                        │                                 │   │
│  └────────────────────────┼─────────────────────────────────┘  │
│                           │                                       │
└───────────────────────────┼───────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
   ┌────▼─────────┐                  ┌─────────▼─────┐
   │  Customer    │                  │   Business    │
   │  App         │                  │   App         │
   │              │                  │               │
   │ • order-     │                  │ • orders.jsx  │
   │   tracking   │                  │ • Real-time   │
   │   /[id].jsx  │                  │   dashboard   │
   │              │                  │               │
   └──────────────┘                  └───────────────┘
```

---

## Message Flow

### 1. Customer Order Tracking Flow

**Step 1: Customer connects to order tracking**
```
Customer App ──(WebSocket Connect)──> Server:/ws/track/{order_id}?token=JWT
Customer App <──(connected message)─── Server
  ✓ Receives: {
      "type": "connected",
      "order_id": "...",
      "order_number": "...",
      "status": "pending",
      "payment_status": "paid",
      "created_at": "2026-04-15T..."
    }
```

**Step 2: Business updates order status**
```
Business App ──(updateOrderStatus)──> Backend API
Backend ──(broadcast)──> Order Manager
Order Manager ──(to all connected customers)──> Customer WebSocket
Customer App <──(status_update)─── Server
  ✓ Receives: {
      "type": "status_update",
      "order_id": "...",
      "order_number": "...",
      "status": "confirmed",
      "timestamp": "2026-04-15T..."
    }
  ✓ Updates UI with live indicator
  ✓ Adds timeline entry
```

**Step 3: Heartbeat (every 30 seconds)**
```
Server ──(heartbeat)──> Customer WebSocket
Customer <── {type: "heartbeat"}
```

**Step 4: Reconnection on drop**
```
Connection drops ──> Client detects onError/onClose
Client waits: 1 second (exponential backoff)
Client reconnects ──> Customer App ──(WebSocket Connect)──> Server
✓ Reconnection successful with exponential backoff
```

### 2. Business Shop Orders Flow

**Step 1: Business connects to shop orders**
```
Business App ──(WebSocket Connect)──> Server:/ws/shop/{shop_id}?token=JWT
Business App <──(connected message)─── Server
  ✓ Receives: {
      "type": "connected",
      "shop_id": "...",
      "shop_name": "My Shop"
    }
```

**Step 2: Customer places new order**
```
Customer ──(placeOrder API)──> Backend
Backend ──(broadcast)──> Order Manager
Order Manager ──(to all connected shop owners)──> Business WebSocket
Business App <──(new_order or status_update)─── Server
  ✓ Receives: {
      "type": "status_update",
      "order_id": "...",
      "order_number": "...",
      "status": "pending",
      "timestamp": "2026-04-15T..."
    }
  ✓ Updates orders list in real-time
  ✓ Shows notification badge
```

**Step 3: Heartbeat (every 30 seconds)**
```
Server ──(heartbeat)──> Business WebSocket
Business <── {type: "heartbeat"}
```

---

## Test Case 1: Basic Message Reception (Customer Side)

### Objective
Verify that customer receives initial connection message and status updates.

### Prerequisites
- Customer is logged in
- Order exists in system (e.g., Order ID: `550e8400-e29b-41d4-a716-446655440001`)
- Customer has access to the order

### Test Steps

1. **Open Order Tracking Screen**
   ```
   Navigation: Customer Tab → Orders → Tap Order
   Expected: Skeleton loader appears
   Expected: "LIVE" indicator with pulse animation appears
   ```

2. **Verify Initial Message Reception**
   - Check browser DevTools → Network → WS tab
   - Look for connection to: `ws://localhost:8000/api/v1/orders/ws/track/{order_id}`
   - Verify frames show:
     ```json
     {
       "type": "connected",
       "order_id": "550e8400-e29b-41d4-a716-446655440001",
       "status": "pending",
       "payment_status": "paid"
     }
     ```
   ✅ **PASS**: Initial message received within 2 seconds

3. **Verify Heartbeat Messages**
   - Wait 30+ seconds on tracking screen
   - Verify frames show:
     ```json
     {
       "type": "heartbeat"
     }
     ```
   ✅ **PASS**: Heartbeat appears every ~30 seconds

4. **Verify Ping/Pong**
   - App automatically sends `ping` to keep connection alive
   - Server responds with `{"type": "pong"}`
   ✅ **PASS**: Ping/Pong exchange working

### Expected Results
- ✅ WebSocket connects successfully
- ✅ Initial status message received
- ✅ "LIVE" indicator shows with pulse
- ✅ Heartbeat every 30 seconds
- ✅ Connection stays open while screen is visible

---

## Test Case 2: Status Update Reception (Customer Side)

### Objective
Verify that customer receives real-time status updates from business.

### Prerequisites
- Customer has Order Tracking screen open
- Business user has Shop Orders screen open
- Same order is visible in both screens

### Test Steps

1. **Set Up Both Screens**
   ```
   Customer Device: Order Tracking screen open
   Business Device: Shop Orders screen open (same order visible)
   ```

2. **Business Updates Order Status**
   - On Business screen: Tap "Accept" button on pending order
   - Backend updates: `status: pending → confirmed`
   - Backend calls: `notify_order_status_change(order_id, shop_id, "confirmed")`

3. **Verify Customer Receives Update**
   ```
   Expected on Customer Screen:
   - "LIVE" indicator flashes/pulse continues
   - Timeline shows new entry: "Order Confirmed"
   - Status badge updates: "Pending" → "Confirmed"
   - Order current_status updates
   ```

4. **Verify Message Structure**
   - WebSocket frame shows:
     ```json
     {
       "type": "status_update",
       "order_id": "550e8400-e29b-41d4-a716-446655440001",
       "order_number": "ORD-12345",
       "status": "confirmed",
       "timestamp": "2026-04-15T10:30:45.123456Z"
     }
     ```

5. **Verify Live Update Indicator**
   - After message received, `setLiveUpdate(data)` is called
   - UI shows bright highlight on order
   - After 3 seconds, highlight fades (cleared by timeout)
   ✅ **PASS**: Live update indicator shows and fades

### Expected Results
- ✅ Customer receives status update within 1 second
- ✅ Timeline updates with new status
- ✅ Status badge color changes appropriately
- ✅ Live indicator flashes momentarily
- ✅ Message timestamp is current

---

## Test Case 3: Multiple Status Transitions (Customer Side)

### Objective
Verify that customer receives all intermediate status updates correctly.

### Prerequisites
- Same as Test Case 2
- No network delays simulated

### Test Steps

1. **Start with pending order**
   - Customer: Order Tracking open
   - Status: "pending"

2. **Business: Accept Order (pending → confirmed)**
   - Tap "Accept"
   - Wait 1 second

3. **Verify Customer Update**
   ```
   Expected:
   - Status badge: "Pending" → "Confirmed"
   - Timeline: ["Pending", "Confirmed"]
   ```

4. **Business: Mark Preparing (confirmed → preparing)**
   - Tap "Mark Preparing"
   - Wait 1 second

5. **Verify Customer Update**
   ```
   Expected:
   - Status badge: "Confirmed" → "Preparing"
   - Timeline: ["Pending", "Confirmed", "Preparing"]
   ```

6. **Business: Mark Ready (preparing → ready)**
   - Tap "Mark Ready"
   - Wait 1 second

7. **Verify Customer Update**
   ```
   Expected:
   - Status badge: "Preparing" → "Ready"
   - Timeline: ["Pending", "Confirmed", "Preparing", "Ready"]
   ```

8. **Business: Mark Complete (ready → completed)**
   - Tap "Mark Complete"
   - Wait 1 second

9. **Verify Final State**
   ```
   Expected:
   - Status badge: "Ready" → "Completed"
   - Timeline: ["Pending", "Confirmed", "Preparing", "Ready", "Completed"]
   - All timestamps correct and in sequence
   ```

### Expected Results
- ✅ All 4 status transitions received in order
- ✅ Timeline shows all 5 statuses
- ✅ No skipped or duplicate entries
- ✅ Timestamps in chronological order

---

## Test Case 4: Business Orders Real-Time Feed (Business Side)

### Objective
Verify that business receives new orders in real-time.

### Prerequisites
- Business user logged in
- Shop Orders screen open
- No pending orders currently

### Test Steps

1. **Open Business Shop Orders**
   - Tap Shop → Orders
   - Verify connection to: `ws://localhost:8000/api/v1/orders/ws/shop/{shop_id}`
   - Verify message:
     ```json
     {
       "type": "connected",
       "shop_id": "...",
       "shop_name": "My Shop"
     }
     ```

2. **Place New Order from Customer**
   - On Customer device: Place order for this shop
   - Order status starts as "pending"

3. **Verify Business Receives Order**
   ```
   Expected:
   - "No orders yet" empty state disappears
   - New order appears in list with "Pending" status
   - Appears within 2 seconds
   ```

4. **Verify Message Content**
   - WebSocket frame shows:
     ```json
     {
       "type": "status_update",
       "order_id": "...",
       "order_number": "...",
       "status": "pending",
       "timestamp": "2026-04-15T..."
     }
     ```

### Expected Results
- ✅ Business connected to shop orders WebSocket
- ✅ New orders appear in real-time
- ✅ Order details correct (amount, items, customer name)
- ✅ Timestamp accurate

---

## Test Case 5: Connection Recovery (Reconnection Logic)

### Objective
Verify that WebSocket reconnects automatically on network failures.

### Prerequisites
- Customer or Business has WebSocket connected
- Access to network throttling (DevTools) or ability to toggle WiFi

### Test Steps

1. **Establish Connection**
   - Open Order Tracking (customer) or Shop Orders (business)
   - Verify "LIVE" indicator or "connected" status shows

2. **Simulate Network Disconnect**
   - Method A: Open DevTools → Network → Set throttling to "Offline"
   - Method B: Disable WiFi on device
   - Observe connection drops

3. **Verify Client Detection**
   ```
   Expected:
   - onError handler called
   - scheduleReconnect() triggered
   - Reconnect attempt within 1 second (baseDelay = 1000ms)
   ```

4. **Verify Reconnection Attempts**
   - First attempt: wait 1 second
   - If fails, second attempt: wait 2 seconds
   - If fails, third attempt: wait 4 seconds
   - Pattern: exponential backoff (1s, 2s, 4s, 8s, 16s)

5. **Restore Network**
   - Re-enable WiFi or remove throttling
   - Verify connection restores

6. **Verify State After Reconnection**
   ```
   Expected:
   - reconnectCountRef.current reset to 0
   - "LIVE" indicator returns
   - Fresh status received
   ```

### Expected Results
- ✅ Automatically detects connection loss
- ✅ Attempts reconnection with exponential backoff
- ✅ Reconnects within 5 attempts (max 31 seconds)
- ✅ No manual refresh needed
- ✅ State preserved on reconnection

---

## Test Case 6: Memory Leak Prevention

### Objective
Verify that timeouts are properly cleaned up on unmount.

### Prerequisites
- Access to React Native Debugger or DevTools
- Ability to monitor memory usage

### Test Steps

1. **Monitor Memory Before**
   - Open DevTools → Memory tab
   - Note baseline memory usage

2. **Open Order Tracking**
   - Navigate to order tracking screen
   - Verify "LIVE" connects

3. **Simulate Rapid Navigation**
   - Open tracking → Go back (repeat 10 times quickly)
   - Monitor memory usage

4. **Check for Leaks**
   - Open Order Tracking
   - Receive a status update message
   - Go back immediately (before 3-second timeout)
   - **Verify**: liveUpdateTimeoutRef should be cleared
   - **Verify**: reconnectTimeoutRef should be cleared
   - **Verify**: WebSocket should be closed

5. **Manual Cleanup Verification**
   ```javascript
   // In component's useEffect cleanup
   if (liveUpdateTimeoutRef.current) {
     clearTimeout(liveUpdateTimeoutRef.current)  ✓ REQUIRED
   }
   if (reconnectTimeoutRef.current) {
     clearTimeout(reconnectTimeoutRef.current)    ✓ REQUIRED
   }
   if (wsRef.current) {
     wsRef.current.close()                        ✓ REQUIRED
   }
   ```

### Expected Results
- ✅ Memory remains stable after repeated navigation
- ✅ No timeouts leak between screens
- ✅ WebSocket properly closed on unmount
- ✅ No "Identifier already declared" errors

---

## Test Case 7: Message Parsing and Error Handling

### Objective
Verify that app handles various message types correctly.

### Prerequisites
- WebSocket connected
- Access to backend logs

### Test Steps

1. **Valid Status Update**
   ```json
   {
     "type": "status_update",
     "order_id": "550e8400-e29b-41d4-a716-446655440001",
     "status": "confirmed",
     "timestamp": "2026-04-15T10:30:45Z",
     "description": "Order confirmed by shop"
   }
   ```
   - Expected: Timeline updates, status changes

2. **Heartbeat Message**
   ```json
   {
     "type": "heartbeat"
   }
   ```
   - Expected: Ignored (no UI change, keeps connection alive)

3. **Connection Message**
   ```json
   {
     "type": "connected",
     "order_id": "550e8400-e29b-41d4-a716-446655440001",
     "status": "pending"
   }
   ```
   - Expected: Initial state set, UI loads

4. **Unknown Message Type**
   ```json
   {
     "type": "unknown_type",
     "data": "..."
   }
   ```
   - Expected: Ignored silently (no error)

5. **Malformed JSON** (if sent by backend - shouldn't happen)
   - Server would handle before sending
   - Client logs error in try-catch

### Expected Results
- ✅ All valid message types handled correctly
- ✅ No errors for unknown types
- ✅ Graceful degradation

---

## Test Case 8: Concurrent Updates (Race Condition)

### Objective
Verify that rapid status updates don't cause race conditions.

### Prerequisites
- Customer has Order Tracking open
- Ability to control backend order updates

### Test Steps

1. **Send Rapid Status Updates**
   - Backend sends: pending → confirmed → preparing (3 updates in 500ms)
   
2. **Verify Timeline Integrity**
   ```javascript
   setTracking((prev) => {
     const newTimeline = [...(prev.timeline || [])]
     // Add new status
     newTimeline.push({...})
     return {
       ...prev,
       current_status: data.status,
       timeline: newTimeline
     }
   })
   ```
   - Expected: All 3 updates appear in timeline
   - Expected: Final status shows "preparing"
   - Expected: No skipped entries

3. **Verify Timeline Order**
   - Timeline should show: pending → confirmed → preparing
   - No duplicates
   - No out-of-order entries

### Expected Results
- ✅ All updates processed in order
- ✅ No race conditions in state updates
- ✅ Timeline shows correct sequence

---

## Test Case 9: Cross-Device Synchronization

### Objective
Verify that multiple customers viewing same order see real-time updates.

### Prerequisites
- 2 customer devices (or browser tabs)
- Both viewing same order
- Business device ready to update order

### Test Steps

1. **Open Same Order on Both Devices**
   ```
   Device A: Order Tracking → Order #12345
   Device B: Order Tracking → Order #12345
   Both show "LIVE" connected
   ```

2. **Business Updates Order**
   - Tap "Accept" on business screen
   - Status: pending → confirmed

3. **Verify Sync on Both Devices**
   ```
   Device A: Shows "Confirmed" immediately
   Device B: Shows "Confirmed" immediately
   ✓ Both received same message
   ✓ Timestamps match
   ✓ Timeline identical
   ```

4. **Verify UI State**
   - Both devices show same status color
   - Both show "LIVE" indicator
   - Both have identical timeline

### Expected Results
- ✅ Both devices receive update simultaneously
- ✅ No eventual consistency issues
- ✅ UI states synchronized

---

## Test Case 10: Business Polling Fallback

### Objective
Verify that business orders still update via polling if WebSocket fails.

### Prerequisites
- Business screen open
- Ability to disable WebSocket (DevTools offline mode)

### Test Steps

1. **Disconnect WebSocket**
   - DevTools → Network → Offline
   - Observe WebSocket connection fails

2. **Verify Polling Fallback**
   - Code shows: `setInterval(() => loadOrders(true), 15000)`
   - Expected: Orders refresh every 15 seconds via REST API
   - Data may be stale by up to 15 seconds, but consistent

3. **Re-enable Network**
   - Restore DevTools Network
   - WebSocket reconnects
   - Real-time updates resume

### Expected Results
- ✅ Business orders update via polling if WebSocket down
- ✅ Fallback provides graceful degradation
- ✅ 15-second polling interval ensures reasonable freshness
- ✅ WebSocket reconnection restores real-time updates

---

## Running Automated Tests

### Load Testing Script (for backend developers)
```python
# nearshop-api/tests/test_websocket_orders.py

import asyncio
import websockets
import json
from datetime import datetime, timezone

async def test_customer_tracking():
    """Test customer receiving order updates"""
    async with websockets.connect(
        "ws://localhost:8000/api/v1/orders/ws/track/550e8400-e29b-41d4-a716-446655440001"
        "?token=YOUR_JWT_TOKEN"
    ) as ws:
        # Receive initial connection
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "connected"
        print(f"✓ Connected: {data}")
        
        # Receive heartbeat
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "heartbeat"
        print(f"✓ Received heartbeat")
        
        # Send ping
        await ws.send("ping")
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "pong"
        print(f"✓ Ping-pong working")

async def test_shop_orders():
    """Test business receiving order updates"""
    async with websockets.connect(
        "ws://localhost:8000/api/v1/orders/ws/shop/YOUR_SHOP_ID"
        "?token=YOUR_JWT_TOKEN"
    ) as ws:
        # Receive connection message
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "connected"
        print(f"✓ Shop connected: {data}")
        
        # Wait for heartbeat
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "heartbeat"
        print(f"✓ Received heartbeat")

# Run tests
asyncio.run(test_customer_tracking())
asyncio.run(test_shop_orders())
```

---

## Troubleshooting Guide

### Issue: "WebSocket connection closed unexpectedly"
**Possible Causes:**
- Token expired or invalid
- User not authorized for this order/shop
- Server restart

**Solution:**
- Check backend logs: `nearshop-api/logs/`
- Verify JWT token valid
- Check user permissions in database

### Issue: Customer not receiving updates
**Possible Causes:**
- WebSocket not connected (LIVE indicator missing)
- Message type not handled
- Network throttling enabled

**Solution:**
- Check DevTools Network → WS tab
- Verify message frames show `"type": "status_update"`
- Verify onMessage handler in [id].jsx

### Issue: Business orders not updating in real-time
**Possible Causes:**
- WebSocket not connected
- Shop ID mismatch
- Orders API not calling notify_order_status_change()

**Solution:**
- Verify shop orders WebSocket in Network tab
- Check that updateOrderStatus() exists in backend
- Verify notify_order_status_change() is called after status change

### Issue: Memory leak after repeated navigation
**Possible Causes:**
- liveUpdateTimeoutRef not cleared
- reconnectTimeoutRef not cleared
- WebSocket not closed in cleanup

**Solution:**
- Verify useEffect cleanup function (lines 109-121)
- Check all refs are cleared:
  ```javascript
  return () => {
    if (liveUpdateTimeoutRef.current) clearTimeout(...)
    if (reconnectTimeoutRef.current) clearTimeout(...)
    if (wsRef.current) wsRef.current.close()
  }
  ```

### Issue: Reconnection doesn't work after network restore
**Possible Causes:**
- Max reconnect attempts exceeded (5)
- Reconnect counter not reset on connection
- reconnectCountRef.current not reset on onOpen

**Solution:**
- Verify onOpen handler resets counter:
  ```javascript
  onOpen: () => {
    setWsConnected(true)
    reconnectCountRef.current = 0  // REQUIRED
  }
  ```

---

## Test Results Template

```markdown
## WebSocket Integration Test Results

Date: 2026-04-15
Tester: [Name]
Environment: Mobile | Web
Build: [APK Version]

### Test Cases Results

| Test Case | Status | Notes | Screenshot |
|-----------|--------|-------|------------|
| 1. Basic Message Reception | ✅ PASS | Connection: 1.2s | [link] |
| 2. Status Update Reception | ✅ PASS | Update: 0.8s | [link] |
| 3. Multiple Transitions | ✅ PASS | 4 transitions OK | [link] |
| 4. Business Orders Feed | ✅ PASS | Order appeared: 1.5s | [link] |
| 5. Reconnection Logic | ✅ PASS | 3 attempts, 4s total | [link] |
| 6. Memory Leak Prevention | ✅ PASS | Memory stable | [link] |
| 7. Message Parsing | ✅ PASS | All types handled | [link] |
| 8. Concurrent Updates | ✅ PASS | 3 updates OK | [link] |
| 9. Cross-Device Sync | ✅ PASS | Both devices same | [link] |
| 10. Polling Fallback | ✅ PASS | 15s refresh OK | [link] |

### Summary
- Total Tests: 10
- Passed: 10 ✅
- Failed: 0
- Success Rate: 100%

### Issues Found
None

### Recommendations
Ready for production deployment.
```

---

## Next Steps

1. **Run all test cases** with both devices/browsers
2. **Document results** using template above
3. **Test under network stress** (WiFi off/on, 4G/5G)
4. **Load testing** with 100+ concurrent orders
5. **Deploy to staging** before production
6. **Monitor error logs** for 24 hours post-deployment

---

## Contacts

- **Mobile Development**: [contact]
- **Backend Development**: [contact]
- **QA Lead**: [contact]
- **DevOps**: [contact]
