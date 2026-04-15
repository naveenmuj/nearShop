# NearShop Mobile App - Developer Quick Reference

**For**: Developers maintaining NearShop mobile app  
**Updated**: April 15, 2026

---

## Feature Implementation Quick Reference

### 1. Price Drop Notifications

**Files**: `deals.jsx`

**How it Works**:
```javascript
// User-saved deals appear in horizontal rail with price drop detection
savedDealRailItems = first 5 items from wishlist
Display: "X price drops" if items have discounts, else "X saved"
```

**To Modify**:
- Max saved items shown: Edit line 1175 `.slice(0, 5)` → change `5` to desired count
- Rail styling: Modify `styles.savedDealRailContainer` 
- Price drop detection logic: Check `savedPriceDropCount` calculation

**To Disable**: Comment out lines 1405-1420 in deals.jsx

---

### 2. Infinite Scroll Pagination

**Files**: `deals.jsx`

**How it Works**:
```javascript
// Pagination configuration
pageSize = 20 items per load
page = current page number (starts at 1)
hasMore = true when more items exist
loadingMore = prevents concurrent requests

// Trigger
onEndReached fires at 50% scroll position (onEndReachedThreshold={0.5})
loadMore() function appends 20 items to list
```

**To Modify**:
- Page size: Edit line 864 `const [pageSize, setPageSize] = useState(20);`
- Scroll threshold: Edit line 1237 `onEndReachedThreshold={0.5}` → 0.1 to 1.0
- Loading indicator styling: Check `styles.loadingMoreIndicator`

**To Disable**: Remove `onEndReached={loadMore}` from FlatList props

**Key Guards**:
```javascript
if (loadingMore || !hasMore || isLoading) return; // Prevents race conditions
```

---

### 3. Product Filters & Search

**Files**: `products.jsx`

**How it Works**:
```javascript
// Filter state
showFilters: boolean (modal visibility)
minPrice: 0-100000 (₹ increment)
maxPrice: 0-100000 (₹ increment)
minRating: 0 | 2 | 3 | 4 | 4.5
inStockOnly: boolean

// Filtering happens on "Apply" button press
Filters applied to product list display
```

**To Modify**:
- Price increment: Line 290 → `Math.max(0, minPrice - 1000)` change `1000`
- Max price limit: Line 297 → change `100000`
- Rating options: Line 308 → modify array `[0, 2, 3, 4, 4.5]`
- Filter button text/styling: Search `filterTitle` in styles

**To Add New Filter**:
```javascript
// Add state
const [newFilter, setNewFilter] = useState(defaultValue);

// Add section in modal (before closing View)
<View style={styles.filterSection}>
  <Text style={styles.filterSectionTitle}>New Filter</Text>
  {/* Filter UI here */}
</View>

// Add to filter logic
filters.newFilter = newFilter;
```

**To Disable**: Set `showFilters = false` always

---

### 4. Real-Time Order Updates (WebSocket)

**Files**: `order-tracking/[id].jsx`

**How it Works**:
```javascript
// Connection established on component mount
connectOrderTracking(orderId, authToken, eventHandlers)

// Event handlers
onOpen: Connection established → show "LIVE" indicator
onMessage: Status update received → append to timeline, update current status
onError: Connection error → hide "LIVE"
onClose: Connection closed → hide "LIVE"

// Auto-cleanup
useEffect cleanup closes WebSocket on unmount
```

**Expected WebSocket Messages**:
```json
{
  "type": "order_update",
  "status": "shipped",
  "timestamp": "2026-04-15T06:30:00Z",
  "description": "Order shipped"
}
```

**To Modify Connection Behavior**:
- Server endpoint: Check `connectOrderTracking()` implementation
- Message types: Line 70 → `if (data.type === 'order_update' || data.type === 'status_update')`
- Live flash duration: Line 86 → `setTimeout(() => setLiveUpdate(null), 3000)` change `3000`
- "LIVE" indicator style: Search `styles.liveIndicator`

**To Add Reconnection Logic**:
```javascript
// Current: Simple close on error
// Better: Add exponential backoff
let reconnectDelay = 1000;
const attemptReconnect = () => {
  setTimeout(() => {
    const ws = connectOrderTracking(...);
    reconnectDelay *= 1.5; // Exponential backoff
  }, reconnectDelay);
};
```

**To Disable**: Remove useEffect block (lines 61-101)

---

## API Integration Points

### Price Drop Notifications
**API Called**: `getWishlist()` (line 976)
- Returns user's saved deals
- Used to populate `savedItems` state
- Called on component mount and after claiming deal

### Infinite Scroll
**API Called**: `getNearbyDeals()` and `getPersonalizedDeals()` (lines 904-913)
- `getNearbyDeals(lat, lng, { limit: pageSize })`
- `getPersonalizedDeals(lat, lng, { limit: 30 })`
- Pagination handled via repeated calls with same parameters
- API should return 20 items per request for consistency

### Product Filters
**Filtering Logic**: Client-side (no API change needed)
- Filters applied after data received
- To move to server-side: Pass filter params to API
- Example: `getProducts({ minPrice, maxPrice, minRating, inStockOnly })`

### Real-Time Orders
**WebSocket Endpoint**: `ws://api.nearshop.local/ws/orders/{orderId}`
- Requires: Order ID and auth token
- Sends: Status update events
- Protocol: JSON messages with type, status, timestamp

---

## State Management Flow

```
deals.jsx:
  ├── Pagination State
  │   ├── page (current page number)
  │   ├── pageSize (items per page)
  │   ├── hasMore (more items exist)
  │   └── loadingMore (loading indicator)
  │
  ├── Deals Data
  │   ├── deals (array of deal objects)
  │   ├── isLoading (initial load)
  │   └── error (error message)
  │
  └── Saved Deals
      ├── savedItems (wishlist items)
      ├── savedProductIds (for quick lookup)
      └── savedPriceDropCount (deals with price drops)

products.jsx:
  └── Filter State
      ├── showFilters (modal visibility)
      ├── minPrice / maxPrice (price range)
      ├── minRating (minimum rating)
      ├── inStockOnly (availability filter)
      └── products (filtered product list)

order-tracking/[id].jsx:
  ├── WebSocket State
  │   ├── wsConnected (connection status)
  │   └── liveUpdate (active update indicator)
  │
  └── Tracking Data
      ├── tracking (order details)
      ├── timeline (status history)
      └── current_status (latest status)
```

---

## Common Debugging Scenarios

### Issue: Pagination not loading more items
**Check**:
- `hasMore` state is true
- `loadingMore` not stuck as true
- API returning fewer than 20 items (triggers hasMore=false)
- Category filter matching works correctly

**Fix**:
```javascript
// Add console logs in loadMore function
console.log('loadMore called:', { page, loadingMore, hasMore, isLoading });
console.log('API response:', { itemCount, hasMore: itemCount >= pageSize });
```

### Issue: Filter modal not responding
**Check**:
- `showFilters` state toggles properly
- Modal closed after "Apply" button pressed
- Filter values update in state
- Product list re-renders with new filters

**Fix**:
```javascript
// Ensure handlers call setState
onPress={() => setShowFilters(true)} // open
onPress={() => setShowFilters(false)} // close
```

### Issue: WebSocket not connecting
**Check**:
- Token exists and is valid
- Order ID is correct
- WebSocket endpoint is accessible
- SSL/TLS certificate valid (WSS)

**Fix**:
```javascript
// Add detailed logging
onOpen: () => {
  console.log('WebSocket connected for order:', id);
  setWsConnected(true);
},
onError: (error) => {
  console.error('WebSocket error:', error);
  setWsConnected(false);
},
onClose: () => {
  console.log('WebSocket closed');
  setWsConnected(false);
}
```

### Issue: Saved deals rail not showing
**Check**:
- `savedItems.length > 0`
- Wishlist API call succeeded
- Items have required fields (id, product_id)
- Conditional rendering at line 1405 evaluates true

**Fix**:
```javascript
// Debug saved items
useEffect(() => {
  console.log('Saved items:', savedItems);
  console.log('Saved deal rail items:', savedDealRailItems);
}, [savedItems, savedDealRailItems]);
```

---

## Performance Optimization Tips

1. **Pagination**: 
   - Use VirtualizedList for 500+ items
   - Cache already-loaded pages
   - Lazy load images in deal cards

2. **Filters**:
   - Debounce price range changes
   - Memoize filter results
   - Cache filter options

3. **WebSocket**:
   - Implement message batching
   - Use compression for large updates
   - Add reconnection backoff

4. **General**:
   - Profile with React DevTools
   - Monitor memory in long sessions
   - Use `useMemo` for expensive calculations

---

## Testing Checklist for PRs

- [ ] Pagination loads new items at 50% scroll position
- [ ] No duplicate items in pagination
- [ ] Filters apply and reset correctly
- [ ] Saved deals rail updates when items saved/removed
- [ ] WebSocket connects and shows "LIVE" indicator
- [ ] No console errors
- [ ] No memory leaks on unmount
- [ ] All ESLint warnings addressed
- [ ] Touch targets are min 48x48px
- [ ] Animations smooth at 60fps

---

**Questions?** Check implementation docs in `FEATURE_TESTS.md` and `IMPLEMENTATION_SUMMARY.md`
