"""
NearShop Project Verification Script
=====================================
Run this from the project root: python verify_project.py
It checks every feature from the PRD against actual code.
Paste the FULL output to Claude for analysis.
"""

import os
import re
import json
import subprocess
import sys
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────
API_ROOT = "nearshop-api"
WEB_ROOT = "nearshop-web"
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))

# Auto-detect project root
if (BASE_DIR / API_ROOT).exists():
    PROJECT_ROOT = BASE_DIR
elif (BASE_DIR.parent / API_ROOT).exists():
    PROJECT_ROOT = BASE_DIR.parent
else:
    # Try common locations
    for p in [Path("D:/Local_shop"), Path("D:/Local_shop/nearshop"), Path(".")]:
        if (p / API_ROOT).exists():
            PROJECT_ROOT = p
            break
    else:
        print("ERROR: Cannot find nearshop-api folder. Run this script from the project root.")
        sys.exit(1)

API_DIR = PROJECT_ROOT / API_ROOT
WEB_DIR = PROJECT_ROOT / WEB_ROOT

R = "\033[91m"  # Red
G = "\033[92m"  # Green
Y = "\033[93m"  # Yellow
B = "\033[94m"  # Blue
E = "\033[0m"   # End

results = {"pass": 0, "fail": 0, "warn": 0, "details": []}


def check(condition, label, category="general"):
    status = "PASS" if condition else "FAIL"
    color = G if condition else R
    print(f"  {color}[{status}]{E} {label}")
    if condition:
        results["pass"] += 1
    else:
        results["fail"] += 1
    results["details"].append({"status": status, "label": label, "category": category})
    return condition


def warn(label):
    print(f"  {Y}[WARN]{E} {label}")
    results["warn"] += 1
    results["details"].append({"status": "WARN", "label": label, "category": "warning"})


def section(title):
    print(f"\n{B}{'═'*60}{E}")
    print(f"{B}  {title}{E}")
    print(f"{B}{'═'*60}{E}")


def file_exists(path):
    return (PROJECT_ROOT / path).exists()


def file_contains(path, *patterns):
    fp = PROJECT_ROOT / path
    if not fp.exists():
        return False
    try:
        content = fp.read_text(encoding="utf-8", errors="ignore")
        return all(re.search(p, content, re.IGNORECASE) for p in patterns)
    except:
        return False


def dir_exists(path):
    return (PROJECT_ROOT / path).is_dir()


def count_files(path, ext=".py"):
    p = PROJECT_ROOT / path
    if not p.is_dir():
        return 0
    return len(list(p.rglob(f"*{ext}")))


def grep_in_dir(path, pattern, ext=".py"):
    """Check if any file in dir contains pattern."""
    p = PROJECT_ROOT / path
    if not p.is_dir():
        return False
    for f in p.rglob(f"*{ext}"):
        try:
            if re.search(pattern, f.read_text(encoding="utf-8", errors="ignore"), re.IGNORECASE):
                return True
        except:
            pass
    return False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print(f"\n{'━'*60}")
print(f"  NearShop Project Verification Report")
print(f"  Project root: {PROJECT_ROOT}")
print(f"{'━'*60}")

# ── 1. PROJECT STRUCTURE ──────────────────────────────────────
section("1. PROJECT STRUCTURE")

check(dir_exists(API_ROOT), "nearshop-api/ directory exists", "structure")
check(dir_exists(WEB_ROOT), "nearshop-web/ directory exists", "structure")
check(file_exists(f"{API_ROOT}/app/main.py"), "FastAPI main.py exists", "structure")
check(file_exists(f"{API_ROOT}/requirements.txt"), "requirements.txt exists", "structure")
check(file_exists(f"{API_ROOT}/alembic.ini"), "Alembic configured", "structure")
check(file_exists(f"{API_ROOT}/Dockerfile"), "Backend Dockerfile exists", "structure")
check(file_exists(f"{API_ROOT}/docker-compose.yml") or file_exists("docker-compose.yml"), "docker-compose.yml exists", "structure")
check(file_exists(f"{API_ROOT}/.env") or file_exists(f"{API_ROOT}/.env.example"), ".env or .env.example exists", "structure")
check(file_exists(f"{WEB_ROOT}/package.json"), "Frontend package.json exists", "structure")
check(file_exists(f"{WEB_ROOT}/vite.config.js") or file_exists(f"{WEB_ROOT}/vite.config.ts"), "Vite config exists", "structure")

# ── 2. BACKEND MODULES ───────────────────────────────────────
section("2. BACKEND MODULES (17 required + 2 new)")

REQUIRED_MODULES = [
    "auth", "shops", "products", "orders", "reviews", "deals",
    "stories", "haggle", "loyalty", "community", "feed",
    "analytics", "notifications", "ai", "wishlists", "reservations"
]
NEW_MODULES = ["udhaar", "referral"]

for mod in REQUIRED_MODULES:
    path = f"{API_ROOT}/app/{mod}"
    has_router = file_exists(f"{path}/router.py")
    has_service = file_exists(f"{path}/service.py")
    has_models = file_exists(f"{path}/models.py")
    check(dir_exists(path) and (has_router or has_service),
          f"{mod}/ module (router: {'✓' if has_router else '✗'}, service: {'✓' if has_service else '✗'}, models: {'✓' if has_models else '✗'})",
          "backend_module")

for mod in NEW_MODULES:
    path = f"{API_ROOT}/app/{mod}"
    check(dir_exists(path), f"{mod}/ module (NEW — from gap closure)", "backend_module")

# Categories might be inside products
if not dir_exists(f"{API_ROOT}/app/categories"):
    check(file_exists(f"{API_ROOT}/app/products/categories_router.py") or
          grep_in_dir(f"{API_ROOT}/app/products", r"categories"),
          "categories (inside products module)", "backend_module")

# Core module
check(dir_exists(f"{API_ROOT}/app/core"), "core/ module (database, redis, security)", "backend_module")
check(file_exists(f"{API_ROOT}/app/core/database.py"), "database.py exists", "backend_module")

# ── 3. ROUTER REGISTRATION ───────────────────────────────────
section("3. ROUTER REGISTRATION IN main.py")

main_py = f"{API_ROOT}/app/main.py"
if file_exists(main_py):
    for mod in REQUIRED_MODULES + NEW_MODULES:
        check(file_contains(main_py, f"{mod}"), f"{mod} router imported/registered in main.py", "router_reg")
else:
    warn("main.py not found — cannot check router registration")

# ── 4. KEY BACKEND FEATURES ──────────────────────────────────
section("4. KEY BACKEND FEATURES")

# Auth
check(grep_in_dir(f"{API_ROOT}/app/auth", r"send.?otp|otp.*send"), "Auth: Send OTP", "feature")
check(grep_in_dir(f"{API_ROOT}/app/auth", r"verify.?otp|otp.*verify"), "Auth: Verify OTP", "feature")
check(grep_in_dir(f"{API_ROOT}/app/auth", r"switch.?role|role.*switch"), "Auth: Role switching", "feature")
check(grep_in_dir(f"{API_ROOT}/app/auth", r"jwt|token|bearer"), "Auth: JWT tokens", "feature")

# Shops
check(grep_in_dir(f"{API_ROOT}/app/shops", r"nearby|st_dwithin|haversine|distance"), "Shops: Geo discovery", "feature")
check(grep_in_dir(f"{API_ROOT}/app/shops", r"follow"), "Shops: Follow/unfollow", "feature")
check(grep_in_dir(f"{API_ROOT}/app/shops", r"score|ranking"), "Shops: Score/ranking", "feature")
check(grep_in_dir(f"{API_ROOT}/app/shops", r"qr.?code|qrcode"), "Shops: QR code generation", "feature")
check(grep_in_dir(f"{API_ROOT}/app/shops", r"share.?card"), "Shops: Share card data", "feature")

# Products
check(grep_in_dir(f"{API_ROOT}/app/products", r"ts_vector|full.?text|fts|to_tsvector"), "Products: Full-text search", "feature")
check(grep_in_dir(f"{API_ROOT}/app/products", r"similar|cosine|vector"), "Products: Similar products", "feature")
check(grep_in_dir(f"{API_ROOT}/app/products", r"availability|is_available"), "Products: Toggle availability", "feature")
check(grep_in_dir(f"{API_ROOT}/app/products", r"price.?history|PriceHistory"), "Products: Price history tracking", "feature")

# Orders
check(grep_in_dir(f"{API_ROOT}/app/orders", r"status.*confirmed|confirmed.*status|update.*status"), "Orders: Status lifecycle", "feature")
check(grep_in_dir(f"{API_ROOT}/app/orders", r"cancel"), "Orders: Cancel order", "feature")

# Deals
check(grep_in_dir(f"{API_ROOT}/app/deals", r"nearby|geo|distance"), "Deals: Geo-filtered nearby", "feature")
check(grep_in_dir(f"{API_ROOT}/app/deals", r"claim"), "Deals: Claim deal", "feature")
check(grep_in_dir(f"{API_ROOT}/app/deals", r"expires|expiry|duration"), "Deals: Expiry/duration", "feature")

# Stories
check(grep_in_dir(f"{API_ROOT}/app/stories", r"24.*hour|expire|expiry"), "Stories: 24h expiry", "feature")
check(grep_in_dir(f"{API_ROOT}/app/stories", r"feed"), "Stories: Feed endpoint", "feature")

# Reservations / Hold for Me
check(grep_in_dir(f"{API_ROOT}/app/reservations", r"create|reserve"), "Reservations: Create (Hold for Me)", "feature")
check(grep_in_dir(f"{API_ROOT}/app/reservations", r"fulfill"), "Reservations: Fulfill", "feature")
check(grep_in_dir(f"{API_ROOT}/app/reservations", r"no.?show"), "Reservations: No-show tracking", "feature")
check(grep_in_dir(f"{API_ROOT}/app/reservations", r"cancel|delete"), "Reservations: Customer cancel", "feature")

# Haggle
check(grep_in_dir(f"{API_ROOT}/app/haggle", r"start|create.*session"), "Haggle: Start session", "feature")
check(grep_in_dir(f"{API_ROOT}/app/haggle", r"offer|counter"), "Haggle: Offer/counter", "feature")
check(grep_in_dir(f"{API_ROOT}/app/haggle", r"accept"), "Haggle: Accept", "feature")
check(grep_in_dir(f"{API_ROOT}/app/haggle", r"reject"), "Haggle: Reject", "feature")

# Loyalty
check(grep_in_dir(f"{API_ROOT}/app/loyalty", r"balance|coins"), "Loyalty: ShopCoins balance", "feature")
check(grep_in_dir(f"{API_ROOT}/app/loyalty", r"earn"), "Loyalty: Earn coins", "feature")
check(grep_in_dir(f"{API_ROOT}/app/loyalty", r"badge"), "Loyalty: Badges", "feature")
check(grep_in_dir(f"{API_ROOT}/app/loyalty", r"streak|daily.*checkin|checkin"), "Loyalty: Streak tracking", "feature")
check(grep_in_dir(f"{API_ROOT}/app/loyalty", r"leaderboard"), "Loyalty: Leaderboard", "feature")

# Community
check(grep_in_dir(f"{API_ROOT}/app/community", r"post|question"), "Community: Create post", "feature")
check(grep_in_dir(f"{API_ROOT}/app/community", r"answer"), "Community: Answers", "feature")
check(grep_in_dir(f"{API_ROOT}/app/community", r"upvote"), "Community: Upvote", "feature")

# Feed
check(grep_in_dir(f"{API_ROOT}/app/feed", r"personali|home|feed"), "Feed: Personalized home", "feature")
check(grep_in_dir(f"{API_ROOT}/app/feed", r"hook|contextual"), "Feed: Dynamic hook", "feature")

# AI
check(grep_in_dir(f"{API_ROOT}/app/ai", r"snap|catalog|vision"), "AI: Snap & List cataloging", "feature")
check(grep_in_dir(f"{API_ROOT}/app/ai", r"visual.*search|clip|embedding"), "AI: Visual search", "feature")
check(grep_in_dir(f"{API_ROOT}/app/ai", r"conversational|natural.*language"), "AI: Conversational search", "feature")
check(grep_in_dir(f"{API_ROOT}/app/ai", r"pric(e|ing).*suggest"), "AI: Price suggestion", "feature")
check(grep_in_dir(f"{API_ROOT}/app/ai", r"recommend"), "AI: Recommendations", "feature")

# Notifications
check(grep_in_dir(f"{API_ROOT}/app/notifications", r"create.*notification|notification.*create"), "Notifications: Create function", "feature")
check(grep_in_dir(f"{API_ROOT}/app/notifications", r"unread"), "Notifications: Unread count", "feature")

# Notification auto-triggers (check other modules for notification imports)
check(grep_in_dir(f"{API_ROOT}/app/orders", r"create_notification|notification"), "Notifications: Auto-trigger in orders", "feature")
check(grep_in_dir(f"{API_ROOT}/app/haggle", r"create_notification|notification"), "Notifications: Auto-trigger in haggle", "feature")
check(grep_in_dir(f"{API_ROOT}/app/reviews", r"create_notification|notification"), "Notifications: Auto-trigger in reviews", "feature")

# Wishlists
check(grep_in_dir(f"{API_ROOT}/app/wishlists", r"price.?drop|price_at_save"), "Wishlists: Price drop detection", "feature")

# Udhaar
if dir_exists(f"{API_ROOT}/app/udhaar"):
    check(grep_in_dir(f"{API_ROOT}/app/udhaar", r"extend.*credit|credit.*extend"), "Udhaar: Extend credit", "feature")
    check(grep_in_dir(f"{API_ROOT}/app/udhaar", r"payment"), "Udhaar: Record payment", "feature")
    check(grep_in_dir(f"{API_ROOT}/app/udhaar", r"ledger"), "Udhaar: Shop ledger", "feature")
else:
    check(False, "Udhaar: Module exists", "feature")

# Referral
if dir_exists(f"{API_ROOT}/app/referral"):
    check(grep_in_dir(f"{API_ROOT}/app/referral", r"apply|referral.*code"), "Referral: Apply code", "feature")
    check(grep_in_dir(f"{API_ROOT}/app/referral", r"stats|count"), "Referral: Stats", "feature")
else:
    check(False, "Referral: Module exists", "feature")

# Celery tasks
check(file_exists(f"{API_ROOT}/tasks/celery_app.py"), "Celery: App configured", "feature")
check(grep_in_dir(f"{API_ROOT}/tasks", r"beat_schedule|expire_reservations"), "Celery: Beat schedule defined", "feature")
check(grep_in_dir(f"{API_ROOT}/tasks", r"expire.*deal|deal.*expire"), "Celery: Deal expiry task", "feature")
check(grep_in_dir(f"{API_ROOT}/tasks", r"expire.*stor|stor.*expire"), "Celery: Story expiry task", "feature")

# ── 5. DATABASE ──────────────────────────────────────────────
section("5. DATABASE & MIGRATIONS")

migrations_dir = PROJECT_ROOT / API_ROOT / "migrations" / "versions"
if migrations_dir.is_dir():
    migration_count = len(list(migrations_dir.glob("*.py")))
    check(migration_count >= 3, f"Alembic migrations: {migration_count} migration files found", "database")
else:
    check(False, "Alembic migrations directory exists", "database")

# Check for PostGIS/pgvector usage
check(grep_in_dir(f"{API_ROOT}/app", r"geography|postgis|st_dwithin|geoalchemy"), "PostGIS/Geography columns used", "database")
check(grep_in_dir(f"{API_ROOT}/app", r"vector|pgvector|embedding"), "pgvector/embeddings used", "database")

# ── 6. FRONTEND PAGES ────────────────────────────────────────
section("6. FRONTEND PAGES")

CUSTOMER_PAGES = [
    "HomePage", "SearchPage", "ShopDetailPage", "ProductDetailPage",
    "DealsPage", "WishlistPage", "OrdersPage", "HagglePage",
    "WalletPage", "CommunityPage", "ProfilePage", "ShopsMapPage", "CategoriesPage"
]

BUSINESS_PAGES = [
    "DashboardPage", "CatalogPage", "SnapListPage", "OrdersPage",
    "DealsCreatorPage", "StoriesPage", "HaggleInboxPage",
    "AnalyticsPage", "SettingsPage"
]

AUTH_PAGES = [
    "LoginPage", "VerifyOTPPage", "RoleSelectPage",
    "CustomerOnboard", "BusinessOnboard"
]

for page in AUTH_PAGES:
    found = any(
        file_exists(f"{WEB_ROOT}/src/pages/auth/{page}.jsx") or
        file_exists(f"{WEB_ROOT}/src/pages/auth/{page}.tsx")
        for _ in [1]
    )
    if not found:
        # Try alternate names
        found = grep_in_dir(f"{WEB_ROOT}/src/pages", page.replace("Page", ""))
    check(found, f"Auth: {page}", "frontend_page")

for page in CUSTOMER_PAGES:
    found = (
        file_exists(f"{WEB_ROOT}/src/pages/customer/{page}.jsx") or
        file_exists(f"{WEB_ROOT}/src/pages/customer/{page}.tsx")
    )
    if found:
        # Check if it has real API calls (not just placeholder)
        has_api = grep_in_dir(
            f"{WEB_ROOT}/src/pages/customer",
            r"import.*from.*api|axios|client\.(get|post|put|delete)|fetch\(",
            ext=".jsx"
        )
        status = "✓ + API wired" if has_api else "✓ but may need API wiring"
        check(True, f"Customer: {page} ({status})", "frontend_page")
    else:
        check(False, f"Customer: {page}", "frontend_page")

for page in BUSINESS_PAGES:
    # Business OrdersPage might have a different name
    found = (
        file_exists(f"{WEB_ROOT}/src/pages/business/{page}.jsx") or
        file_exists(f"{WEB_ROOT}/src/pages/business/{page}.tsx")
    )
    check(found, f"Business: {page}", "frontend_page")

# ── 7. FRONTEND API MODULES ─────────────────────────────────
section("7. FRONTEND API MODULES")

API_MODULES = [
    "client", "auth", "shops", "products", "orders", "deals",
    "stories", "reviews", "categories", "wishlists", "haggle",
    "loyalty", "community", "reservations", "analytics",
    "notifications", "ai"
]

for mod in API_MODULES:
    found = (
        file_exists(f"{WEB_ROOT}/src/api/{mod}.js") or
        file_exists(f"{WEB_ROOT}/src/api/{mod}.ts")
    )
    check(found, f"API module: {mod}.js", "frontend_api")

# ── 8. FRONTEND COMPONENTS ───────────────────────────────────
section("8. FRONTEND COMPONENTS")

COMPONENTS = [
    "ShopCard", "ProductCard", "ProductGrid", "SearchBar",
    "StoryCircle", "DealBanner", "RatingStars", "CoinsBadge",
    "NotificationBell", "LoadingSpinner", "EmptyState"
]

for comp in COMPONENTS:
    found = grep_in_dir(f"{WEB_ROOT}/src/components", comp, ext=".jsx") or \
            grep_in_dir(f"{WEB_ROOT}/src/components", comp, ext=".tsx")
    check(found, f"Component: {comp}", "frontend_component")

# ── 9. FRONTEND STATE & HOOKS ────────────────────────────────
section("9. FRONTEND STATE & HOOKS")

check(grep_in_dir(f"{WEB_ROOT}/src/store", r"auth|user|token"), "Zustand: Auth store", "frontend_state")
check(grep_in_dir(f"{WEB_ROOT}/src/store", r"location|lat|lng|gps"), "Zustand: Location store", "frontend_state")
check(grep_in_dir(f"{WEB_ROOT}/src/store", r"cart"), "Zustand: Cart store", "frontend_state")
check(
    file_exists(f"{WEB_ROOT}/src/hooks/useImageUpload.js") or
    file_exists(f"{WEB_ROOT}/src/hooks/useImageUpload.ts") or
    grep_in_dir(f"{WEB_ROOT}/src/hooks", r"image.*upload|upload.*image"),
    "Hook: useImageUpload", "frontend_state"
)

# ── 10. FRONTEND CONFIG ──────────────────────────────────────
section("10. FRONTEND CONFIG")

check(file_exists(f"{WEB_ROOT}/tailwind.config.js") or file_exists(f"{WEB_ROOT}/tailwind.config.ts"),
      "Tailwind CSS configured", "frontend_config")

# Check if react-router is used
check(grep_in_dir(f"{WEB_ROOT}/src", r"react-router|BrowserRouter|createBrowserRouter", ext=".jsx"),
      "React Router configured", "frontend_config")

# PWA
check(
    file_exists(f"{WEB_ROOT}/public/manifest.json") or
    grep_in_dir(f"{WEB_ROOT}", r"vite-plugin-pwa|VitePWA", ext=".js"),
    "PWA: manifest or vite-plugin-pwa", "frontend_config"
)

# ── SUMMARY ──────────────────────────────────────────────────
section("SUMMARY")

total = results["pass"] + results["fail"]
pct = round(results["pass"] / total * 100, 1) if total else 0

print(f"\n  {G}PASS: {results['pass']}{E}")
print(f"  {R}FAIL: {results['fail']}{E}")
print(f"  {Y}WARN: {results['warn']}{E}")
print(f"  Total checks: {total}")
print(f"  Completion: {pct}%")

print(f"\n{'━'*60}")
print(f"  FAILED ITEMS (copy everything below this line for Claude):")
print(f"{'━'*60}")
for d in results["details"]:
    if d["status"] == "FAIL":
        print(f"  FAIL: {d['label']} [{d['category']}]")

print(f"\n{'━'*60}")
print(f"  End of verification report")
print(f"{'━'*60}\n")