import sys
from sqlalchemy import text
from app.database import engine

def main():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';"))
            tables = [row[0] for row in result.fetchall()]
            print("TABLES:", tables)
            
            if 'users' in tables:
                res = conn.execute(text("SELECT * FROM users;"))
                print("USERS:", res.fetchall())
    except Exception as e:
        print("ERROR:", str(e))

if __name__ == '__main__':
    main()
