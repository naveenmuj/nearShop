# NearShop Mobile App - Critical Fixes Implementation Guide

**Purpose**: Step-by-step guide to fix the 3 critical issues found in code review  
**Time Estimate**: 1-2 hours  
**Priority**: Deploy these before production

---

## Critical Issue #1: WebSocket Memory Leak

**Location**: `nearshop-mobile/app/(customer)/order-tracking/[id].jsx`

**Before (Buggy)**:
```javascript
const onMessage: (data) => {
  if (data.type === 'order_update' || data.type === 'status_update') {
    setLiveUpdate(data)
    // ...
    setTimeout(() => setLiveUpdate(null), 3000)  // ❌ Not cleaned up!
  }
}
```

**After (Fixed)**:
```javascript
const timeoutRef = useRef(null);

// In the WebSocket effect
const ws = connectOrderTracking(id, token, {
  onOpen: () => {
    setWsConnected(true)
  },
  onMessage: (data) => {
    if (data.type === 'order_update' || data.type === 'status_update') {
      setLiveUpdate(data)
      
      // Update tracking data...
      setTracking((prev) => {
        if (!prev) return prev
        const newTimeline = [...(prev.timeline || [])]
        if (data.status && data.timestamp) {
          newTimeline.push({
            status: data.status,
            timestamp: data.timestamp,
            description: data.description || `Order ${data.status}`,
          })
        }
        return {
          ...prev,
          current_status: data.status || prev.current_status,
          timeline: newTimeline,
        }
      })
      
      // Clean up previous timeout if exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Set new timeout with cleanup
      timeoutRef.current = setTimeout(() => {
        setLiveUpdate(null)
        timeoutRef.current = null
      }, 3000)
    }
  },
  onError: () => {
    setWsConnected(false)
  },
  onClose: () => {
    setWsConnected(false)
  },
})
wsRef.current = ws

// Update cleanup function
return () => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)  // ✅ Clean up timeout
  }
  if (wsRef.current) {
    wsRef.current.close()
    wsRef.current = null
  }
}
```

**What Changed**:
- Added `timeoutRef` to track timeout ID
- Clear previous timeout before setting new one
- Clean up timeout in component unmount
- Prevents "state update on unmounted component" warning

---

## Critical Issue #2: Pagination Deduplication Bug

**Location**: `nearshop-mobile/app/(customer)/deals.jsx` (lines 920-925)

**Before (Buggy)**:
```javascript
} else {
  // For subsequent pages, just filter nearby
  nearbyItems.forEach((item) => {
    if (!item?.id) return;
    if (!matchesCategory(item)) return;
    merged.push(item);  // ❌ Duplicates if same item in page 1 & 2
  });
}
```

**After (Fixed)**:
```javascript
} else {
  // For subsequent pages, filter nearby AND deduplicate
  const existingIds = new Set(deals.map(d => d.id));  // ✅ Get already-loaded IDs
  nearbyItems.forEach((item) => {
    if (!item?.id) return;
    if (existingIds.has(item.id)) return;  // ✅ Skip if already loaded
    if (!matchesCategory(item)) return;
    merged.push(item);
  });
}
```

**What Changed**:
- Create Set of IDs from already-loaded deals
- Check each new item against existing items
- Skip duplicates before adding to merged list
- Prevents duplicate items in infinite scroll

---

## Critical Issue #3: Category Change Race Condition

**Location**: `nearshop-mobile/app/(customer)/deals.jsx` (useEffect with loadDeals)

**Before (Buggy)**:
```javascript
useEffect(() => {
  setIsLoading(true);
  setPage(1);
  setHasMore(true);
  loadDeals(1, false).finally(() => setIsLoading(false));
}, [loadDeals]);  // ❌ Depends on loadDeals, which has complex dependencies
```

**Problem**: The `loadDeals` function depends on `activeCategory`. When category changes, `loadDeals` gets recreated. But the dependency chain can cause race conditions with pagination state.

**After (Fixed)**:
```javascript
useEffect(() => {
  setIsLoading(true);
  setPage(1);
  setHasMore(true);
  loadDeals(1, false).finally(() => setIsLoading(false));
}, [activeCategory]);  // ✅ Direct dependency on the thing that actually changes
```

**What Changed**:
- Changed from depending on `loadDeals` to depending on `activeCategory`
- More explicit about what triggers the reload
- Prevents state inconsistency when category changes
- Ensures pagination resets when filtering

**Alternative Fix** (if you want to keep loadDeals dependency):
```javascript
useEffect(() => {
  // Reset pagination when any filter changes
  setPage(1);
  setHasMore(true);
  setIsLoading(true);
  
  loadDeals(1, false).finally(() => setIsLoading(false));
}, [loadDeals, activeCategory]);  // Both dependencies
```

---

## How to Apply These Fixes

### Step 1: Fix WebSocket Memory Leak

1. Open `nearshop-mobile/app/(customer)/order-tracking/[id].jsx`
2. Add `const timeoutRef = useRef(null);` after the other useRef declarations (around line 30)
3. Replace the entire WebSocket useEffect (lines 61-101) with the fixed version above
4. Save and test:
   - Open order tracking
   - Verify "LIVE" indicator appears
   - Navigate away while live update is active
   - Check that no memory warnings appear in console

### Step 2: Fix Pagination Deduplication

1. Open `nearshop-mobile/app/(customer)/deals.jsx`
2. Find the `else` block around line 918-925
3. Replace with:
```javascript
} else {
  // For subsequent pages, filter nearby AND deduplicate
  const existingIds = new Set(deals.map(d => d.id));
  nearbyItems.forEach((item) => {
    if (!item?.id) return;
    if (existingIds.has(item.id)) return;
    if (!matchesCategory(item)) return;
    merged.push(item);
  });
}
```
4. Save and test:
   - Load deals page
   - Scroll to bottom to load page 2
   - Scroll to bottom to load page 3
   - Verify no items repeat in list
   - Verify total items = page * 20 (no duplicates)

### Step 3: Fix Category Change Race Condition

1. Open `nearshop-mobile/app/(customer)/deals.jsx`
2. Find the useEffect around line 946 that has `}, [loadDeals]);`
3. Change to: `}, [activeCategory]);`
4. Save and test:
   - Load deals for one category
   - Switch to another category
   - Verify list resets to page 1
   - Verify pagination state is clean

---

## Testing Checklist

After applying all 3 fixes, verify:

### WebSocket Fix
- [ ] Order tracking page loads
- [ ] "LIVE" indicator appears when connected
- [ ] Navigate away and back
- [ ] No console warnings about state updates
- [ ] Live updates still work after reconnect

### Pagination Fix
- [ ] Load deals page
- [ ] Scroll to bottom multiple times
- [ ] Count total items = (pages loaded * 20)
- [ ] No duplicate items visible
- [ ] Scroll performance remains smooth

### Category Fix
- [ ] Load deals
- [ ] Change to different category
- [ ] Page counter resets to 1
- [ ] No old category items appear
- [ ] Pagination works correctly in new category

---

## Code Impact Summary

| Issue | Lines Changed | Files Modified | Complexity |
|-------|---------------|-----------------|-----------|
| WebSocket Memory Leak | ~15 lines | 1 file | Low |
| Pagination Deduplication | ~8 lines | 1 file | Low |
| Category Race Condition | 1 line | 1 file | Very Low |

**Total Lines**: ~24 lines across 2 files  
**Total Complexity**: Low (straightforward fixes)  
**Risk Level**: Low (isolated changes, well-tested patterns)

---

## Before & After Performance

### WebSocket
- **Before**: Memory leak on every live update
- **After**: Clean memory management, no leaks

### Pagination
- **Before**: Possible duplicates, poor UX
- **After**: Clean list with no duplicates

### Category Switching
- **Before**: Race condition possible, state inconsistent
- **After**: Clean state reset, reliable behavior

---

## Questions Answered

**Q: Will this break existing functionality?**  
A: No. These are pure bug fixes that make existing behavior work correctly.

**Q: Do I need to update the API?**  
A: No. All fixes are client-side only.

**Q: Should I release these immediately?**  
A: Yes. These are critical stability fixes. Recommend releasing ASAP, even as a hotfix.

**Q: What if users report the old behavior?**  
A: The old behavior was buggy. The new behavior is correct. Communicate: "Fixed memory leak, improved pagination reliability"

---

## Additional Recommendations

### After These Fixes, Consider:
1. Implement WebSocket reconnection (High Priority)
2. Add pagination loading indicator (Low Priority)
3. Reset pagination on search/filter (Medium Priority)
4. Fix price filter edge cases (Medium Priority)

See `CODE_REVIEW_ISSUES.md` for details on these recommendations.

---

**Generated**: April 15, 2026  
**Ready for**: Implementation  
**Estimated Time**: 30 minutes - 1 hour
