"""
Full system cleanup — wipes all data from PostgreSQL + Firebase.
Run from nearshop-api directory: python cleanup_all.py
"""

import os
import sys
import ssl
import json

# ── 1. Database cleanup ─────────────────────────────────────────────────────

def get_db_connection():
    """Connect to DigitalOcean PostgreSQL using psycopg2."""
    try:
        import psycopg2
    except ImportError:
        print("Installing psycopg2-binary...")
        os.system(f"{sys.executable} -m pip install psycopg2-binary -q")
        import psycopg2

    # Parse from .env
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        from dotenv import load_dotenv
        load_dotenv()
        db_url = os.getenv("DATABASE_URL", "")

    if not db_url:
        print("ERROR: DATABASE_URL not found in environment or .env")
        sys.exit(1)

    # Convert asyncpg URL to psycopg2 format
    conn_str = db_url.replace("postgresql+asyncpg://", "postgresql://")
    # Remove ?ssl=require and handle SSL via sslmode
    if "?ssl=require" in conn_str:
        conn_str = conn_str.replace("?ssl=require", "")

    is_remote = "localhost" not in conn_str and "127.0.0.1" not in conn_str

    if is_remote:
        conn = psycopg2.connect(conn_str, sslmode="require")
    else:
        conn = psycopg2.connect(conn_str)

    conn.autocommit = False
    return conn


def diagnose_data(conn):
    """Check existing data for crash-causing issues."""
    cur = conn.cursor()
    print("\n" + "=" * 60)
    print("  DIAGNOSING DATABASE DATA")
    print("=" * 60)

    # Count rows in each table
    tables = [
        "users", "otp_codes", "shops", "products", "orders", "reviews",
        "deals", "stories", "follows", "user_events", "search_logs",
        "wishlists", "price_history", "bills", "delivery_zones",
        "reservations", "shop_coins_ledger", "badges", "user_streaks",
        "stock_logs", "community_posts", "community_answers",
        "haggle_sessions", "haggle_messages", "notifications",
        "udhaar_accounts", "udhaar_transactions", "broadcast_messages",
        "user_recently_viewed", "user_recent_searches",
        "order_tracking_events", "achievements", "user_achievements",
        "daily_spins", "expenses", "categories", "product_embeddings",
    ]

    total_rows = 0
    for table in tables:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            if count > 0:
                print(f"  {table}: {count} rows")
            total_rows += count
        except Exception:
            conn.rollback()  # Reset failed transaction

    print(f"\n  Total rows across all tables: {total_rows}")

    # Check for corrupted user data
    print("\n--- Checking for data issues ---")

    try:
        cur.execute("SELECT id, name, phone, email, firebase_uid, roles, active_role, is_active FROM users")
        users = cur.fetchall()
        for u in users:
            uid, name, phone, email, fuid, roles, active_role, is_active = u
            issues = []
            if not name or name.strip() == "":
                issues.append("missing name")
            if not phone and not email:
                issues.append("no phone or email")
            if not roles:
                issues.append("empty roles array")
            if active_role and roles and active_role not in roles:
                issues.append(f"active_role '{active_role}' not in roles {roles}")
            if not is_active:
                issues.append("account deactivated")
            if issues:
                print(f"  USER {uid}: {', '.join(issues)}")
            else:
                print(f"  USER {uid}: OK (name={name}, roles={roles})")
    except Exception as e:
        print(f"  Error checking users: {e}")
        conn.rollback()

    # Check shops for missing owner references
    try:
        cur.execute("""
            SELECT s.id, s.name, s.owner_id, u.id as user_exists
            FROM shops s LEFT JOIN users u ON s.owner_id = u.id
        """)
        shops = cur.fetchall()
        for s in shops:
            sid, sname, owner_id, user_exists = s
            if not user_exists:
                print(f"  SHOP {sid} ({sname}): ORPHANED - owner {owner_id} not found!")
            else:
                print(f"  SHOP {sid} ({sname}): OK")
    except Exception as e:
        print(f"  Error checking shops: {e}")
        conn.rollback()

    # Check products with missing shop
    try:
        cur.execute("""
            SELECT COUNT(*) FROM products p
            LEFT JOIN shops s ON p.shop_id = s.id
            WHERE s.id IS NULL
        """)
        orphaned = cur.fetchone()[0]
        if orphaned > 0:
            print(f"  PRODUCTS: {orphaned} orphaned products (shop deleted)")
    except Exception as e:
        conn.rollback()

    print()
    return total_rows


def wipe_database(conn):
    """Delete all data from all tables in the correct order."""
    cur = conn.cursor()
    print("\n" + "=" * 60)
    print("  WIPING ALL DATABASE DATA")
    print("=" * 60)

    # Delete in dependency order (children first)
    delete_order = [
        # Engagement & activity
        "daily_spins",
        "user_achievements",
        "user_recently_viewed",
        "user_recent_searches",
        "order_tracking_events",

        # Haggle
        "haggle_messages",
        "haggle_sessions",

        # Community
        "community_answers",
        "community_posts",

        # Inventory & billing
        "stock_logs",
        "expenses",
        "bills",
        "broadcast_messages",

        # Udhaar
        "udhaar_transactions",
        "udhaar_accounts",

        # Loyalty
        "shop_coins_ledger",
        "badges",
        "user_streaks",

        # Product-related
        "product_embeddings",
        "price_history",
        "wishlists",

        # Orders & reviews
        "reviews",
        "orders",

        # Delivery
        "delivery_zones",

        # Shop content
        "deals",
        "stories",
        "reservations",

        # Notifications
        "notifications",

        # Products (after all FK refs deleted)
        "products",

        # User-shop relations
        "follows",
        "user_events",
        "search_logs",

        # Shops (after all shop FKs deleted)
        "shops",

        # Auth
        "otp_codes",

        # Users (last - everything else references them)
        "users",
    ]

    for table in delete_order:
        try:
            cur.execute(f"DELETE FROM {table}")
            count = cur.rowcount
            if count > 0:
                print(f"  Deleted {count} rows from {table}")
            else:
                print(f"  {table}: already empty")
        except Exception as e:
            print(f"  ERROR deleting from {table}: {e}")
            conn.rollback()
            # Try to continue with next table
            continue

    # Also try to delete categories and achievements (reference data)
    for table in ["categories", "achievements"]:
        try:
            cur.execute(f"DELETE FROM {table}")
            count = cur.rowcount
            if count > 0:
                print(f"  Deleted {count} rows from {table}")
        except Exception:
            conn.rollback()

    conn.commit()
    print("\n  Database wipe complete!")


# ── 2. Firebase cleanup ─────────────────────────────────────────────────────

def wipe_firebase():
    """Delete all users from Firebase Authentication."""
    print("\n" + "=" * 60)
    print("  WIPING ALL FIREBASE USERS")
    print("=" * 60)

    try:
        import firebase_admin
        from firebase_admin import credentials, auth as firebase_auth
    except ImportError:
        print("Installing firebase-admin...")
        os.system(f"{sys.executable} -m pip install firebase-admin -q")
        import firebase_admin
        from firebase_admin import credentials, auth as firebase_auth

    # Find service account file
    sa_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
    if not os.path.exists(sa_path):
        print(f"  WARNING: {sa_path} not found. Skipping Firebase cleanup.")
        return

    # Initialize Firebase if not already done
    try:
        app = firebase_admin.get_app()
    except ValueError:
        cred = credentials.Certificate(sa_path)
        app = firebase_admin.initialize_app(cred)

    # List and delete all users
    deleted_count = 0
    page = firebase_auth.list_users()

    while page:
        for user in page.users:
            try:
                print(f"  Deleting Firebase user: {user.uid} ({user.email or user.phone_number or 'no-id'})")
                firebase_auth.delete_user(user.uid)
                deleted_count += 1
            except Exception as e:
                print(f"  ERROR deleting {user.uid}: {e}")

        # Get next page
        page = page.get_next_page()

    print(f"\n  Deleted {deleted_count} Firebase users")


# ── 3. Verification ─────────────────────────────────────────────────────────

def verify_clean(conn):
    """Verify all tables are empty."""
    cur = conn.cursor()
    print("\n" + "=" * 60)
    print("  VERIFYING CLEAN STATE")
    print("=" * 60)

    tables = [
        "users", "shops", "products", "orders", "reviews", "deals",
        "stories", "follows", "wishlists", "notifications", "otp_codes",
    ]

    all_clean = True
    for table in tables:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            status = "CLEAN" if count == 0 else f"DIRTY ({count} rows)"
            if count > 0:
                all_clean = False
            print(f"  {table}: {status}")
        except Exception:
            conn.rollback()

    if all_clean:
        print("\n  ALL TABLES ARE CLEAN!")
    else:
        print("\n  WARNING: Some tables still have data")

    return all_clean


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  NEARSHOP FULL SYSTEM CLEANUP")
    print("  This will DELETE ALL data from DB + Firebase")
    print("=" * 60)

    # Load .env
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        os.system(f"{sys.executable} -m pip install python-dotenv -q")
        from dotenv import load_dotenv
        load_dotenv()

    # Step 1: Connect and diagnose
    print("\nConnecting to database...")
    conn = get_db_connection()
    print("  Connected!")

    total = diagnose_data(conn)

    # Step 2: Wipe database
    wipe_database(conn)

    # Step 3: Wipe Firebase
    wipe_firebase()

    # Step 4: Verify
    verify_clean(conn)

    conn.close()

    print("\n" + "=" * 60)
    print("  CLEANUP COMPLETE!")
    print("  You can now start fresh with a new login.")
    print("=" * 60)


if __name__ == "__main__":
    main()
