import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
url = os.getenv('DATABASE_URL', '')
if not url:
    raise SystemExit('DATABASE_URL missing')

dsn = url.replace('postgresql+asyncpg://', 'postgresql://').replace('ssl=require', 'sslmode=require')
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute(
    """
    select table_name
    from information_schema.tables
    where table_schema='public'
      and table_name in ('conversations','messages','message_templates')
    order by table_name
    """
)
print('tables:', cur.fetchall())

for table in ('conversations', 'messages', 'message_templates'):
    cur.execute(
        """
        select column_name
        from information_schema.columns
        where table_schema='public' and table_name=%s
        order by ordinal_position
        """,
        (table,),
    )
    cols = [r[0] for r in cur.fetchall()]
    print(f'{table} columns:', cols)

cur.close()
conn.close()
