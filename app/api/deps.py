from ledger.db import DEFAULT_DB_PATH, connect_db


def get_db():
    conn = connect_db(DEFAULT_DB_PATH, check_same_thread=False)
    try:
        yield conn
    finally:
        conn.close()
