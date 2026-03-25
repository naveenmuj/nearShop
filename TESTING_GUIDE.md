# 🧪 NearShop Test & Deployment Guide

## Quick Start (Local Testing)

### Option 1: One-Command Start (Linux/macOS with tmux)
```bash
cd d:/Local_shop
chmod +x start-all.sh
./start-all.sh
```

This will start:
- Backend API on `http://localhost:8000`
- Web App on `http://localhost:5173`
- Mobile App (Expo) with QR code

### Option 2: Manual Start (Windows)

**Terminal 1 - Backend API:**
```bash
cd nearshop-api
python -m uvicorn app.main:app --reload --port 8000
```
✓ API running at: `http://localhost:8000`
✓ Docs at: `http://localhost:8000/docs` (interactive API explorer!)

**Terminal 2 - Web App:**
```bash
cd nearshop-web
npm install
npm run dev
```
✓ Web running at: `http://localhost:5173`

**Terminal 3 - Mobile App (Optional):**
```bash
cd nearshop-mobile
npm install
npm start
```
✓ Scan QR code with Expo Go app

---

## 🧪 Running Tests

### Comprehensive E2E Test Suite

```bash
# Make sure backend is running first!
cd d:/Local_shop
python run-tests.py
```

**Tests Included:**
- ✓ Backend health check
- ✓ Unified search (products + shops)
- ✓ Search suggestions
- ✓ Nearby shops with delivery
- ✓ Delivery eligibility check
- ✓ Cart validation
- ✓ Web app homepage
- ✓ Full end-to-end flow

**Expected Output:**
```
✓ Backend health check
✓ Unified search (found 15 products, 8 shops)
✓ Search suggestions (12 suggestions)
✓ Nearby shops with delivery (10 shops found)
✓ Delivery check (can_deliver: true)
✓ Cart validation (can_checkout: true)
✓ Web app homepage loads

==============================================================
TEST SUMMARY
==============================================================
Total Tests: 7
Passed: 7
Failed: 0
==============================================================

🎉 All tests passed!
```

---

## 📱 Web App Testing Checklist

### Homepage (`http://localhost:5173`)
- [ ] Page loads within 2 seconds
- [ ] Greeting displays customer name
- [ ] Categories carousel visible
- [ ] "Shops Delivering to You" carousel shows
- [ ] Can scroll shops horizontally
- [ ] Nearby shops grid displays
- [ ] Trending products section visible
- [ ] All images load correctly
- [ ] Animations are smooth (no lag)

### Search Page (`/customer/search`)
- [ ] Search bar accepts input
- [ ] Unified results show (products + shops mixed)
- [ ] Products show shop name
- [ ] Shops show distance and delivery badge
- [ ] Typing shows autocomplete suggestions
- [ ] Clicking suggestion searches correctly
- [ ] No layout shifts during loading
- [ ] Mobile responsive (hamburger menu works)

### Shop Detail Page (`/customer/shop/{id}`)
- [ ] Cover image loads
- [ ] Shop name and logo display
- [ ] Rating and reviews count visible
- [ ] **NEW:** Delivery badge shows (✓ Delivers or ✗ Cannot deliver)
- [ ] Delivery fee clearly displayed
- [ ] Minimum order highlighted
- [ ] Action buttons (Call, Chat, Follow) work
- [ ] Products tab loads and displays items
- [ ] Reviews tab shows ratings
- [ ] Smooth animations on tab transitions

### Cart & Checkout
- [ ] Add to cart works from product pages
- [ ] Multiple shops can be mixed in cart
- [ ] Cart groups items by shop
- [ ] Delivery fees shown per shop
- [ ] Total delivery cost calculated
- [ ] Checkout button enabled/disabled correctly
- [ ] **NEW:** Cannot proceed if delivery not available

---

## 📱 Mobile App Testing Checklist (React Native / Expo)

### Prerequisites
- Install Expo Go on phone (iOS App Store or Android Play Store)
- When `npm start` shows QR code, scan it

### Home Tab (`/(tabs)/`)
- [ ] **NEW:** Delivery shops carousel visible at top
- [ ] Can scroll carousel left/right
- [ ] Shops show delivery/pickup badge
- [ ] Nearby shops list loads below
- [ ] Location permission requested on first open
- [ ] All animations smooth

### Search Tab
- [ ] **NEW:** Unified search results (products + shops)
- [ ] Search bar responsive to touch
- [ ] Suggestions appear as you type
- [ ] Product cards and shop cards both display
- [ ] Delivery info shown on each shop card

### Shop Detail
- [ ] **NEW:** Delivery badge displays status
- [ ] Can scroll through products
- [ ] Add to cart works
- [ ] Reviews load

### Profile & Settings
- [ ] Profile data loads
- [ ] Settings accessible
- [ ] Logout works

---

## 🐛 Common Issues & Fixes

### Issue: "Backend API not responding"
```bash
# Kill any processes on port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID {pid} /F

# macOS/Linux:
lsof -i :8000
kill -9 {pid}

# Then restart:
cd nearshop-api
python -m uvicorn app.main:app --reload --port 8000
```

### Issue: "Module not found" in backend
```bash
cd nearshop-api
pip install -r requirements.txt
```

### Issue: "npm: command not found"
- Install Node.js from https://nodejs.org
- Restart terminal

### Issue: "Port 5173 already in use"
```bash
# Kill process on port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID {pid} /F

# macOS/Linux:
lsof -i :5173
kill -9 {pid}
```

### Issue: "Location permission not working on mobile"
- Check phone settings → NearShop app → Permissions
- Ensure location is set to "Always" or "While Using"
- Restart app

---

## 🚀 API Manual Testing (Postman/cURL)

### 1. Unified Search
```bash
curl "http://localhost:8000/api/v1/search/unified?q=food&lat=12.9352&lng=77.6245"
```

### 2. Get Nearby Shops
```bash
curl "http://localhost:8000/api/v1/delivery/nearby-shops?lat=12.9352&lng=77.6245&radius_km=5&limit=10"
```

### 3. Check Delivery
```bash
curl -X POST "http://localhost:8000/api/v1/delivery/check/{shop_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_lat": 12.9352,
    "customer_lng": 77.6245
  }'
```

### 4. Interactive API Docs
Open: **http://localhost:8000/docs**
- Try all endpoints with built-in UI
- See request/response formats
- Test with real data

---

## 📊 Performance Testing

### Backend Performance
```bash
# Test API response time
import time
start = time.time()
requests.get("http://localhost:8000/api/v1/search/unified?q=food&lat=12.9352&lng=77.6245")
end = time.time()
print(f"Response time: {(end-start)*1000:.2f}ms")

# Target: < 500ms
```

### Web App Performance
- Open DevTools (F12)
- Go to Performance/Lighthouse tab
- Run audit
- Check:
  - FCP (First Contentful Paint): < 2s
  - LCP (Largest Contentful Paint): < 3s
  - CLS (Cumulative Layout Shift): < 0.1

---

## ✅ Pre-Release Checklist

- [ ] All API endpoints returning correct data
- [ ] Web app responsive on mobile (375px), tablet (768px), desktop (1920px)
- [ ] Mobile app tested on iOS simulator
- [ ] Mobile app tested on Android emulator
- [ ] All animations smooth (60fps)
- [ ] No console errors in browser
- [ ] No console errors in app
- [ ] Dark mode tested (if implemented)
- [ ] Offline mode handles gracefully (if implemented)
- [ ] Error messages user-friendly
- [ ] Loading states show properly
- [ ] Database migrations applied
- [ ] Env variables set correctly
- [ ] CORS enabled properly
- [ ] Rate limiting configured

---

## 🚢 Production Deployment

### Backend (Heroku/Railway)
```bash
cd nearshop-api
git add .
git commit -m "Production ready"
git push heroku main
```

### Web (Vercel/Netlify)
```bash
cd nearshop-web
npm run build
# Deploy dist/ folder to Vercel/Netlify
```

### Mobile (App Store/Play Store)
```bash
cd nearshop-mobile
eas build --platform all
# Follow EAS instructions for submission
```

---

## 📞 Support

- **API Docs:** http://localhost:8000/docs
- **Frontend Issues:** Check browser console (F12)
- **Mobile Issues:** Check Expo console
- **Backend Issues:** Check API logs in terminal
- **Database Issues:** Check PostgreSQL logs

---

## 🎯 Success Criteria

All features are working correctly when:
1. ✅ Backend APIs respond in < 500ms
2. ✅ Web app loads completely in < 3 seconds
3. ✅ All 6 new endpoints working (tested with run-tests.py)
4. ✅ Unified search shows products + shops
5. ✅ Delivery badges show correct status
6. ✅ Shop carousel scrolls smoothly
7. ✅ Mobile app responsive and smooth
8. ✅ No crashes or unhandled errors
9. ✅ Location-based features working
10. ✅ All animations performing smoothly

---

**Last Updated:** 2026-03-24
**Version:** 1.0.0
**Status:** Ready for Testing ✅

