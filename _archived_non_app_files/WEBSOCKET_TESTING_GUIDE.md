# WebSocket Testing Summary & Quick Start

## 🎯 What Was Fixed

The WebSocket implementation in the order tracking screen now has:

1. **Memory Leak Prevention** ✅
   - `liveUpdateTimeoutRef` clears the 3-second highlight timeout on unmount
   - `reconnectTimeoutRef` clears pending reconnection attempts on unmount
   - WebSocket properly closed when component unmounts

2. **Automatic Reconnection with Exponential Backoff** ✅
   - Connection drops → automatically reconnects
   - Backoff delays: 1s → 2s → 4s → 8s → 16s
   - Max 5 attempts (31 seconds total)
   - Counter resets on successful connection

3. **Robust Message Handling** ✅
   - Handles connection, status updates, and heartbeats
   - Timeline updates with proper state management
   - Live indicator shows and fades appropriately

---

## 📋 Quick Testing Checklist

### For Customer Side (Order Tracking)

- [ ] **Basic Connection**
  - [ ] Open order tracking screen
  - [ ] "LIVE" indicator appears with pulse
  - [ ] DevTools Network → WS tab shows connection

- [ ] **Status Updates**
  - [ ] Business updates order status
  - [ ] Customer receives update in 1-2 seconds
  - [ ] Timeline adds new entry
  - [ ] Status badge color changes

- [ ] **Network Recovery**
  - [ ] Turn off WiFi while tracking order
  - [ ] Wait 5 seconds
  - [ ] Turn WiFi back on
  - [ ] "LIVE" indicator returns (reconnected)
  - [ ] No manual refresh needed

- [ ] **Memory Cleanup**
  - [ ] Open order tracking → go back (repeat 5 times)
  - [ ] Check memory usage stable
  - [ ] No uncleared timeouts in DevTools

### For Business Side (Shop Orders)

- [ ] **Real-Time Feed**
  - [ ] Open shop orders screen
  - [ ] Customer places new order
  - [ ] Order appears in 1-2 seconds
  - [ ] Don't need to refresh manually

- [ ] **Status Broadcasting**
  - [ ] Update order status (Accept/Reject/Progress)
  - [ ] If customer has tracking open, they see update
  - [ ] Update happens within 1-2 seconds

- [ ] **Network Fallback**
  - [ ] Disconnect network
  - [ ] Orders still update via polling (every 15s)
  - [ ] Reconnect network
  - [ ] Switch back to real-time updates

---

## 🧪 Running Automated Tests

### Backend WebSocket Tests

```bash
# From project root
cd d:\Local_shop

# 1. Start the backend
python -m uvicorn nearshop-api.app.main:app --reload

# 2. In another terminal, run WebSocket tests
python test_websocket_integration.py \
  --server http://localhost:8000/api/v1 \
  --token YOUR_JWT_TOKEN \
  --order-id YOUR_ORDER_ID \
  --shop-id YOUR_SHOP_ID
```

**Expected Output:**
```
============================================================
NearShop WebSocket Integration Tests
============================================================
[HH:MM:SS.mmm] ✅ WebSocket connected
[HH:MM:SS.mmm] 📨 Received initial message
    {
      "type": "connected",
      "order_id": "...",
      "status": "pending"
    }
[HH:MM:SS.mmm] 📨 Received heartbeat
[HH:MM:SS.mmm] ✅ Ping-pong working correctly

============================================================
TEST SUMMARY
============================================================
✅ Customer Order Tracking: PASS
✅ Business Shop Orders: PASS
✅ Invalid Token Rejection: PASS
✅ Unauthorized Order Access: PASS
============================================================
Total: 4 | Passed: 4 ✅ | Failed: 0 ❌
Success Rate: 100.0%
============================================================
```

### Manual Mobile Testing

See **TEST_WEBSOCKET_INTEGRATION.md** for detailed manual test cases with:
- Step-by-step instructions
- Expected results
- DevTools Network inspection steps
- Troubleshooting guides

---

## 📊 Message Flow Diagrams

### Customer Receives Order Update

```
┌──────────────┐                                    ┌──────────────┐
│ Business App │                                    │ Customer App │
└──────────────┘                                    └──────────────┘
      │                                                    │
      │ Tap "Accept Order"                                │
      ├──────────────────────────────────────────────────>│
      │ POST /orders/{id}/status                          │
      │ {"status": "confirmed"}                           │
      │                                                    │
      │ <────────────────────────────────────────────────┤
      │           OK                                      │
      │                                                    │
      │ Backend: update DB                                │
      │ Backend: notify_order_status_change()             │
      │ Backend: broadcast to order_tracking_manager      │
      │                                                    │
      │                                              Order Tracking
      │                                              WebSocket Receives
      │                                              status_update
      │                                                    │
      │                                              ✅ Timeline updates
      │                                              ✅ Status changes
      │                                              ✅ Live indicator
      │                                              flashes
      │                                                    │
```

### Business Receives New Order

```
┌──────────────┐                                    ┌──────────────┐
│ Customer App │                                    │ Business App │
└──────────────┘                                    └──────────────┘
      │                                                    │
      │ Click "Place Order"                               │
      │ POST /orders                                      │
      ├─────────────────────────────────────────────────>│
      │                                                    │
      │ Backend: Create order                             │
      │ Backend: notify_order_status_change()             │
      │ Backend: broadcast to shop_tracking_manager       │
      │                                                    │
      │                                              Shop Orders
      │                                              WebSocket Receives
      │                                              status_update
      │                                                    │
      │                                              ✅ Order appears
      │                                              in list
      │                                              ✅ Correct status
      │                                              ✅ Right details
      │                                                    │
```

---

## 🔍 Verification Checklist

### Code Changes Applied

- [x] **[id].jsx**: Added ref tracking for timeouts and reconnection
- [x] **[id].jsx**: Implemented exponential backoff reconnection logic
- [x] **[id].jsx**: Added proper cleanup in useEffect
- [x] **[id].jsx**: Fixed memory leak with setTimeout tracking

### Test Files Created

- [x] **TEST_WEBSOCKET_INTEGRATION.md**: 10 manual test cases with detailed steps
- [x] **test_websocket_integration.py**: Automated backend WebSocket tests

### Files to Review

- **nearshop-mobile/app/(customer)/order-tracking/[id].jsx** → Lines 25-39, 71-130
  - State refs for timeout and reconnection management
  - Reconnection logic with exponential backoff
  - Proper cleanup in useEffect return

- **nearshop-mobile/lib/orders.js** → Lines 103-135
  - connectOrderTracking() implementation
  - connectShopOrders() implementation

- **nearshop-api/app/orders/router.py** → Lines 930-1000
  - WebSocket endpoint for customer tracking
  - WebSocket endpoint for shop orders
  - Message broadcast functions

---

## 🚀 Testing Execution Plan

### Phase 1: Automated Tests (10 min)
```bash
# Run the Python test script
python test_websocket_integration.py --server http://localhost:8000/api/v1 --token JWT_TOKEN

# Expected: All 4 tests pass
```

### Phase 2: Manual Customer Testing (15 min)

**Scenario A: Basic Message Reception**
1. Customer opens order tracking
2. Verify "LIVE" indicator appears
3. Business updates order status
4. Verify customer receives update in <2 seconds

**Scenario B: Network Recovery**
1. Customer has tracking open
2. Disable WiFi
3. Wait 5 seconds
4. Enable WiFi
5. Verify "LIVE" comes back (reconnected)

### Phase 3: Manual Business Testing (15 min)

**Scenario C: Real-Time Orders**
1. Business opens shop orders
2. Customer places order
3. Verify order appears in <2 seconds

**Scenario D: Concurrent Updates**
1. Business has 2 orders
2. Update both simultaneously
3. Verify both customers receive updates

### Phase 4: Load Testing (Optional, 30 min)
- Simulate 100+ concurrent order tracking connections
- Simulate 10+ concurrent shop orders connections
- Monitor server memory and CPU
- Verify no message loss

---

## 📈 Success Metrics

### Target Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Connection Time | <2s | Time to "LIVE" indicator |
| Message Latency | <1s | Time for customer to receive update |
| Reconnection Time | <5s | Time from network drop to reconnected |
| Memory Leaks | 0 | Verified with DevTools |
| Message Loss | 0% | All updates delivered |
| Success Rate | 100% | All test cases pass |

### Validation Steps

1. **Latency Test**
   ```bash
   # Backend sends timestamp with message
   # Client measures: receive_time - send_time
   # Expected: <1000ms
   ```

2. **Memory Test**
   ```bash
   # DevTools: Heap snapshot before
   # Open/close order tracking 10 times
   # DevTools: Heap snapshot after
   # Expected: Memory difference <5MB
   ```

3. **Reliability Test**
   ```bash
   # 100 status updates per order
   # Monitor: All 100 received and processed
   # Expected: 100/100 = 100% delivery
   ```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Business orders polling fallback
**Current**: 15-second polling interval
**Impact**: If WebSocket down, up to 15s delay in seeing new orders
**Workaround**: Reduce interval to 10s if needed (trade-off: more API calls)

### Issue 2: Reconnection max limit
**Current**: Max 5 attempts (31 seconds total)
**Impact**: If server down >31s, stops trying to reconnect
**Solution**: Manual refresh available in UI

### Issue 3: No message queuing
**Current**: Messages sent during disconnect are lost
**Impact**: Customer misses updates during network outage
**Solution**: App loads initial state from API on reconnect

---

## 📞 Support & Debugging

### Check Server is Running
```bash
# Backend API
curl http://localhost:8000/api/v1/health

# Expected: 200 OK with {"status": "ok"}
```

### Check JWT Token Valid
```bash
# Verify token in DevTools
# Open order tracking
# Network → WS → click connection
# Check URL has: ?token=YOUR_JWT_TOKEN

# If token expired:
# Log out and log in again
# JWT tokens expire after 24 hours
```

### Enable Debug Logging
```javascript
// In nearshop-mobile/app/(customer)/order-tracking/[id].jsx
// Add to onMessage handler:
console.log('📨 Received:', data)

// Add to WebSocket handlers:
onOpen: () => {
  console.log('🟢 WebSocket connected')
  setWsConnected(true)
  reconnectCountRef.current = 0
}

onError: (error) => {
  console.log('🔴 WebSocket error:', error)
  setWsConnected(false)
  scheduleReconnect()
}
```

### Monitor Network Tab
1. Open DevTools
2. Network tab → WS filter
3. Click on WebSocket connection
4. View "Messages" tab
5. See all sent/received frames

---

## 📋 Deployment Checklist

Before deploying to production:

- [ ] All 10 manual test cases pass
- [ ] Automated tests pass (100% success rate)
- [ ] No memory leaks detected (DevTools)
- [ ] Latency <2 seconds for all updates
- [ ] Reconnection works under all network conditions
- [ ] Load test with 1000+ concurrent connections passes
- [ ] Business orders polling fallback works
- [ ] Error handling doesn't crash app
- [ ] Logs reviewed for any warnings
- [ ] Performance monitoring enabled

---

## 📝 Test Report Template

Use this template to document your test results:

```
# WebSocket Testing Report

Date: [DATE]
Tester: [NAME]
Environment: [DEV/STAGING/PRODUCTION]
Build Version: [APK/WEB BUILD NUMBER]

## Test Environment
- Backend: [URL]
- Frontend: [APK/WEB VERSION]
- Network: [WiFi/4G/5G]
- Devices: [List of test devices]

## Test Results

### Automated Tests
- Customer Order Tracking: ✅ PASS
- Business Shop Orders: ✅ PASS
- Invalid Token Rejection: ✅ PASS
- Unauthorized Order Access: ✅ PASS

### Manual Tests
- Basic Message Reception: ✅ PASS
- Status Update Reception: ✅ PASS
- Multiple Status Transitions: ✅ PASS
- Business Orders Feed: ✅ PASS
- Connection Recovery: ✅ PASS
- Memory Leak Prevention: ✅ PASS
- Message Parsing: ✅ PASS
- Concurrent Updates: ✅ PASS
- Cross-Device Sync: ✅ PASS
- Polling Fallback: ✅ PASS

## Performance Metrics
- Connection Time: [TIME]ms
- Message Latency: [TIME]ms
- Reconnection Time: [TIME]ms
- Memory Increase: [SIZE]MB
- CPU Usage Peak: [PERCENT]%

## Issues Found
[List any issues, or "None"]

## Recommendations
[Ready for production / Needs more testing / etc]

## Sign-off
Tester: [SIGNATURE]
Date: [DATE]
```

---

## 🎓 Next Steps

1. **Run automated tests** using the Python script
2. **Execute manual tests** using the detailed guide in TEST_WEBSOCKET_INTEGRATION.md
3. **Document results** using the test report template
4. **Fix any issues** that arise
5. **Deploy** to staging first
6. **Monitor** in production for 24-48 hours
7. **Collect feedback** from users
8. **Deploy** to full production if stable

---

## 📚 Related Files

| File | Purpose | Location |
|------|---------|----------|
| Order Tracking Screen | Customer WebSocket client | nearshop-mobile/app/(customer)/order-tracking/[id].jsx |
| Shop Orders Screen | Business WebSocket client | nearshop-mobile/app/(business)/orders.jsx |
| Orders API | Backend REST endpoints | nearshop-api/app/orders/router.py |
| WebSocket Manager | Connection management | nearshop-api/app/core/websocket_manager.py |
| Test Guide | Manual test cases | nearshop-mobile/TEST_WEBSOCKET_INTEGRATION.md |
| Test Script | Automated tests | test_websocket_integration.py |

---

**Last Updated**: 2026-04-15
**Status**: ✅ Ready for Testing
