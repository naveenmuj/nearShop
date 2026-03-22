"""
Migrate local NearShop PostgreSQL data to DigitalOcean cloud database.
Handles FK ordering, ARRAY vs JSON columns, savepoints, and Windows encoding.
"""
import sys
import psycopg2
import psycopg2.extras
from datetime import datetime

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")

LOCAL_URL = "postgresql://postgres:Winter%23123@localhost:5432/nearshop"
CLOUD_URL = "postgresql://doadmin:AVNS_CnbiEA4G1nu10PFAkZj@db-postgresql-nearshop-do-user-31264740-0.e.db.ondigitalocean.com:25060/defaultdb?sslmode=require"

# Tables in FK dependency order (parents before children)
ORDERED_TABLES = [
    "users",
    "otp_codes",
    "badges",
    "categories",       # self-ref, handled specially
    "shops",
    "products",
    "product_embeddings",
    "follows",
    "deals",
    "orders",
    "price_history",
    "reviews",
    "stories",
    "haggle_sessions",
    "haggle_messages",
    "reservations",
    "community_posts",
    "community_answers",
    "notifications",
    "shopcoins_ledger",
    "user_events",
    "user_streaks",
    "wishlists",
    "search_logs",
    "udhaar_accounts",
    "udhaar_transactions",
]


def get_column_meta(conn, table):
    """Return list of (column_name, data_type) tuples."""
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def adapt_row(row, col_meta):
    """
    Adapt Python values for psycopg2 insertion.
    - ARRAY columns: pass Python list as-is (psycopg2 handles natively)
    - JSON/JSONB columns: wrap dict/list with Json adapter
    - Other: pass as-is
    """
    adapted = []
    for value, (col_name, data_type, udt_name) in zip(row, col_meta):
        if value is None:
            adapted.append(None)
        elif data_type in ("json", "jsonb") and isinstance(value, (dict, list)):
            adapted.append(psycopg2.extras.Json(value))
        elif data_type == "ARRAY" and isinstance(value, list):
            # Keep as Python list — psycopg2 auto-adapts to PostgreSQL array
            adapted.append(value)
        elif isinstance(value, dict):
            # Dicts from JSONB returned as dict — wrap with Json
            adapted.append(psycopg2.extras.Json(value))
        else:
            adapted.append(value)
    return adapted


def copy_table(src_cur, dst_conn, dst_cur, table, col_meta):
    columns = [c[0] for c in col_meta]

    if table == "categories":
        src_cur.execute(
            f"SELECT {', '.join(columns)} FROM {table} ORDER BY parent_id NULLS FIRST"
        )
    else:
        src_cur.execute(f"SELECT {', '.join(columns)} FROM {table}")
    rows = src_cur.fetchall()

    if not rows:
        print(f"  {table}: 0 rows (empty)")
        return 0

    placeholders = ", ".join(["%s"] * len(columns))
    col_names = ", ".join(columns)
    sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    count = 0
    errors = 0
    for row in rows:
        try:
            dst_cur.execute("SAVEPOINT sp1")
            dst_cur.execute(sql, adapt_row(row, col_meta))
            dst_cur.execute("RELEASE SAVEPOINT sp1")
            count += 1
        except Exception as e:
            dst_cur.execute("ROLLBACK TO SAVEPOINT sp1")
            errors += 1
            if errors <= 2:
                msg = str(e).split("\n")[0][:120]
                print(f"    SKIP in {table}: {msg}")

    dst_conn.commit()
    suffix = f" ({errors} skipped)" if errors else ""
    print(f"  {table}: {count} rows migrated{suffix}")
    return count


def main():
    ts = lambda: datetime.now().strftime("%H:%M:%S")
    print(f"[{ts()}] Connecting to databases...")

    src = psycopg2.connect(LOCAL_URL)
    dst = psycopg2.connect(CLOUD_URL)
    src.autocommit = True

    src_cur = src.cursor()
    dst_cur = dst.cursor()

    # Get tables in local DB
    src_cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name != 'alembic_version'
    """)
    local_tables = {t[0] for t in src_cur.fetchall()}

    # Clear any stale data in cloud
    dst_cur.execute("SELECT COUNT(*) FROM users")
    existing = dst_cur.fetchone()[0]
    if existing > 0:
        print(f"  Clearing {existing} existing users from cloud (truncate cascade)...")
        for table in reversed(ORDERED_TABLES):
            try:
                dst_cur.execute(f"TRUNCATE {table} CASCADE")
            except Exception:
                pass
        dst.commit()
        print("  Done.\n")

    print(f"[{ts()}] Starting data migration...\n")

    total_rows = 0
    for table in ORDERED_TABLES:
        if table not in local_tables:
            continue
        try:
            col_meta = get_column_meta(src, table)
            if not col_meta:
                continue
            count = copy_table(src_cur, dst, dst_cur, table, col_meta)
            total_rows += count
        except Exception as e:
            dst.rollback()
            print(f"  {table}: FAILED - {e}")

    print()
    print("=" * 50)
    print("VERIFICATION (cloud DB row counts):")
    for table in ORDERED_TABLES:
        try:
            dst_cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = dst_cur.fetchone()[0]
            if count > 0:
                print(f"  {table}: {count} rows")
        except Exception:
            pass

    print()
    print(f"[{ts()}] Migration complete. Total rows: {total_rows}")
    src.close()
    dst.close()


if __name__ == "__main__":
    main()
