# NearShop Mobile App - Code Review: Issues & Improvements

**Date**: April 15, 2026  
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Issues Found

### 🔴 CRITICAL: WebSocket Memory Leak

**File**: `order-tracking/[id].jsx` (Line 86)

**Issue**:
```javascript
setTimeout(() => setLiveUpdate(null), 3000)  // Not cleaned up!
```

**Problem**:
- If component unmounts before timeout completes, `setLiveUpdate` is called on unmounted component
- Causes memory leak warning: "Can't perform a React state update on an unmounted component"
- Timer keeps running even after component destroyed

**Impact**: Memory leak in long sessions with quick navigation

**Fix**:
```javascript
const timeoutRef = useRef(null);

const onMessage: (data) => {
  if (data.type === 'order_update' || data.type === 'status_update') {
    setLiveUpdate(data)
    // Update tracking data...
    
    // Clear previous timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout and store reference
    timeoutRef.current = setTimeout(() => {
      setLiveUpdate(null);
      timeoutRef.current = null;
    }, 3000);
  }
}

// In cleanup function
return () => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }
  if (wsRef.current) {
    wsRef.current.close();
    wsRef.current = null;
  }
}
```

---

### 🔴 CRITICAL: Pagination Deduplication Bug

**File**: `deals.jsx` (Lines 920-925)

**Issue**:
```javascript
} else {
  // For subsequent pages, just filter nearby
  nearbyItems.forEach((item) => {
    if (!item?.id) return;
    if (!matchesCategory(item)) return;
    merged.push(item);  // ❌ No deduplication!
  });
}
```

**Problem**:
- When loading page 2+, items are NOT checked against already-loaded items
- If API returns overlapping items or same item appears in multiple pages, duplicates will be added
- Only deduplicates within current batch, not across all loaded items

**Impact**: Duplicate deals appear in list, poor UX, data consistency issues

**Fix**:
```javascript
} else {
  // For subsequent pages, filter against already-loaded items
  const existingIds = new Set(deals.map(d => d.id));
  nearbyItems.forEach((item) => {
    if (!item?.id) return;
    if (existingIds.has(item.id)) return;  // ✅ Check existing
    if (!matchesCategory(item)) return;
    merged.push(item);
  });
}
```

---

### 🔴 CRITICAL: Race Condition in Category Change

**File**: `deals.jsx` (useEffect dependency chain)

**Issue**:
When user changes `activeCategory`:
1. `loadDeals` is called with new category
2. Pagination state (`page`, `hasMore`) NOT reset
3. If user scrolls to load more, it fetches page 2 with OLD pagination context

**Problem**:
```javascript
useEffect(() => {
  setIsLoading(true);
  setPage(1);
  setHasMore(true);
  loadDeals(1, false).finally(() => setIsLoading(false));
}, [loadDeals]);  // ⚠️ loadDeals depends on activeCategory
```

The dependency on `loadDeals` works, but there's a timing issue.

**Impact**: Category change loads wrong page numbers, duplicates, or misses items

**Fix**:
```javascript
useEffect(() => {
  setIsLoading(true);
  setPage(1);
  setHasMore(true);
  loadDeals(1, false).finally(() => setIsLoading(false));
}, [activeCategory]);  // ✅ Explicit dependency on category, not loadDeals
```

---

### 🟠 HIGH: WebSocket No Reconnection Logic

**File**: `order-tracking/[id].jsx` (Lines 61-101)

**Issue**:
```javascript
onError: () => {
  setWsConnected(false)
  // ❌ No attempt to reconnect!
},
onClose: () => {
  setWsConnected(false)
  // ❌ Connection just closes permanently!
}
```

**Problem**:
- If WebSocket connection drops, it never reconnects
- User must navigate away and back to re-establish connection
- No exponential backoff for reconnection attempts
- No notification to user that connection was lost

**Impact**: Real-time updates stop if connection drops, poor reliability

**Fix**:
```javascript
const reconnectRef = useRef(null);
const [reconnectCount, setReconnectCount] = useState(0);

const attemptReconnect = useCallback(() => {
  if (!id || !token) return;
  
  const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000); // Max 30s
  
  reconnectRef.current = setTimeout(() => {
    const ws = connectOrderTracking(id, token, {
      // ... handlers ...
      onError: () => {
        setWsConnected(false);
        setReconnectCount(prev => prev + 1);
        attemptReconnect();
      },
    });
    wsRef.current = ws;
  }, delay);
}, [id, token, reconnectCount]);
```

---

### 🟠 HIGH: SavedPriceDropCount Accuracy

**File**: `deals.jsx` (Lines 1182-1188)

**Issue**:
```javascript
const savedPriceDropCount = useMemo(() => savedItems.filter((item) => {
  const oldPrice = Number(item.price_at_save ?? item.product_price ?? item.price ?? 0);
  const currentPrice = Number(item.current_price ?? item.price ?? item.product_price ?? 0);
  return oldPrice > 0 && currentPrice > 0 && currentPrice < oldPrice;
}).length, [savedItems]);
```

**Problems**:
1. If `price_at_save` is not stored when user saves, comparison fails (defaults to 0)
2. Fallback chain is unclear: `price_at_save` → `product_price` → `price`
3. Doesn't account for price == oldPrice (no change means no drop)
4. If current_price is null, comparison fails silently

**Impact**: Price drop count is inaccurate, misleading users

**Better Approach**:
```javascript
// When user saves a deal, store the current price
const handleSave = async (deal) => {
  await addToWishlist({
    product_id: deal.product_id,
    saved_price: getDealFinalPrice(deal),  // ✅ Explicitly store save price
    saved_at: new Date().toISOString(),
  });
};

// Then compare accurately
const savedPriceDropCount = useMemo(() => {
  return savedItems.filter((item) => {
    const savedPrice = Number(item.saved_price ?? 0);
    const currentPrice = Number(item.current_price ?? 0);
    return savedPrice > 0 && currentPrice > 0 && currentPrice < savedPrice;
  }).length;
}, [savedItems]);
```

---

### 🟡 MEDIUM: Pagination Doesn't Reset on Filter/Search Change

**File**: `deals.jsx`

**Issue**:
When user:
1. Loads deals (page 1, 20 items)
2. Types search query or changes sort
3. Deals list updates but `page` state stays at 1

**Problem**:
```javascript
// Search filtering is in a separate useMemo
const visibleActiveDeals = useMemo(
  () => filteredActiveDeals.filter(matchesSearch),  // ✅ Filters correctly
  [filteredActiveDeals, matchesSearch]
);

// But page state NOT reset
// So if user was on page 3, search changes list, still thinks on page 3
```

**Impact**: User might try to "load more" thinking they're not at end, but list is already filtered

**Fix**:
```javascript
useEffect(() => {
  // Reset pagination when search/filter changes
  setPage(1);
  setHasMore(true);
}, [searchQuery, activeCategory, sortMode]);
```

---

### 🟡 MEDIUM: Price Filter Edge Cases

**File**: `products.jsx` (Line 160)

**Issue**:
```javascript
const price = Number(normalized?.price || 0);
if (price < minPrice || price > maxPrice) return;
```

**Problems**:
1. If product has `price = null`, becomes `Number(0)`, passes all price filters
2. Free products (price = 0) treated as invalid but might be legitimate
3. Negative prices (data error) not handled

**Impact**: Free products disappear from filters, data quality issues cause silent failures

**Fix**:
```javascript
const price = normalized?.price;
if (price === null || price === undefined) {
  // Handle missing price gracefully
  if (minPrice > 0) return;  // Exclude if filtering for paid items
} else {
  const numPrice = Number(price);
  if (numPrice < minPrice || numPrice > maxPrice) return;
}
```

---

### 🟡 MEDIUM: Filter Modal No Loading State

**File**: `products.jsx` (Lines 269-350)

**Issue**:
When user taps "Apply Filters":
```javascript
<Pressable style={styles.filterApplyBtn} onPress={handleApplyFilters}>
  <Text>Apply</Text>
</Pressable>
```

**Problem**:
- No loading indicator while filters are being applied
- User doesn't know if click registered
- Could tap multiple times causing multiple filter applications

**Impact**: Poor UX, potential performance issue from multiple filter applications

**Fix**:
```javascript
const [applyingFilters, setApplyingFilters] = useState(false);

const handleApplyFilters = useCallback(async () => {
  setApplyingFilters(true);
  try {
    // Apply filters (if async)
    setShowFilters(false);
  } finally {
    setApplyingFilters(false);
  }
}, [...deps]);

<Pressable 
  style={styles.filterApplyBtn} 
  onPress={handleApplyFilters}
  disabled={applyingFilters}
>
  <Text>{applyingFilters ? '⏳ Applying...' : 'Apply'}</Text>
</Pressable>
```

---

### 🟡 MEDIUM: Unused State Variable

**File**: `deals.jsx` (Line 864)

**Issue**:
```javascript
const [pageSize, setPageSize] = useState(20);
// ❌ setPageSize is never called
// ✅ pageSize is used, but never modified
```

**Problem**:
- Dead code, confuses maintenance
- Takes up memory for unused setter
- Suggests incomplete implementation

**Fix**: Remove or implement properly
```javascript
const pageSize = 20;  // Just use constant if not changing
// Or implement if dynamic page sizing is planned
```

---

### 🟢 LOW: Missing Loading Indicator for Pagination

**File**: `deals.jsx`

**Issue**:
When `loadingMore = true`, user has no visual feedback that more items are loading

**Impact**: UX is unclear, users might not understand why no new items appear

**Fix**:
```javascript
{loadingMore && (
  <View style={styles.loadingMoreContainer}>
    <ActivityIndicator size="small" color={COLORS.primary} />
    <Text style={styles.loadingMoreText}>Loading more deals...</Text>
  </View>
)}
```

---

### 🟢 LOW: ESLint Warnings (Non-Critical)

**File**: `deals.jsx`

**Issues**:
- Unused variables: `Platform`, `FlipDigit`, `countdown`, `urgencyColor`
- Hook dependency warnings: Several useEffect/useMemo missing dependencies
- Missing display names in fallback components (already have displayName set)

**Fix**: Remove unused imports, add missing dependencies to hooks

---

## Summary Table

| Issue | Severity | File | Line(s) | Type |
|-------|----------|------|---------|------|
| WebSocket Memory Leak | 🔴 Critical | order-tracking/[id].jsx | 86 | Memory |
| Pagination Deduplication | 🔴 Critical | deals.jsx | 920-925 | Logic |
| Category Change Race | 🔴 Critical | deals.jsx | Dependencies | Logic |
| WebSocket No Reconnection | 🟠 High | order-tracking/[id].jsx | 61-101 | Reliability |
| Price Drop Count Accuracy | 🟠 High | deals.jsx | 1182-1188 | Logic |
| Pagination Not Reset on Search | 🟡 Medium | deals.jsx | N/A | UX |
| Price Filter Edge Cases | 🟡 Medium | products.jsx | 160 | Logic |
| Filter Modal UX | 🟡 Medium | products.jsx | 269-350 | UX |
| Unused Variable | 🟡 Medium | deals.jsx | 864 | Code Quality |
| Missing Loading Indicator | 🟢 Low | deals.jsx | 1236+ | UX |
| ESLint Warnings | 🟢 Low | deals.jsx | Various | Code Quality |

---

## Recommendations (Priority Order)

### Phase 1 (Immediate - Fix Critical Issues)
1. ✅ Fix WebSocket memory leak (line 86)
2. ✅ Fix pagination deduplication bug (line 920-925)
3. ✅ Fix category change race condition (useEffect dependency)

### Phase 2 (Important - Fix High Issues)
4. ✅ Implement WebSocket reconnection logic
5. ✅ Improve SavedPriceDropCount accuracy

### Phase 3 (Enhancement - Fix Medium Issues)
6. ✅ Reset pagination on search/filter change
7. ✅ Handle price filter edge cases
8. ✅ Add filter modal loading state
9. ✅ Remove unused variables

### Phase 4 (Polish - Fix Low Issues)
10. ✅ Add pagination loading indicator
11. ✅ Fix ESLint warnings

---

## Estimated Implementation Time

- **Phase 1**: 1-2 hours
- **Phase 2**: 2-3 hours
- **Phase 3**: 2-3 hours
- **Phase 4**: 1-2 hours

**Total**: ~6-10 hours for all improvements

---

**Impact Assessment**:
- **Without fixes**: App will likely crash or have bugs in production with heavy use
- **With Phase 1 fixes**: App becomes stable
- **With all fixes**: App reaches production-quality standards

---

Generated: April 15, 2026  
Ready for: Implementation Roadmap
