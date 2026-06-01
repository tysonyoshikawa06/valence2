import os
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def _configure_conn(conn):
    conn.prepare_threshold = None

pool = ConnectionPool(
    DATABASE_URL,
    min_size=2,
    max_size=10,
    open=False,
    max_lifetime=300,
    max_idle=60,
    reconnect_timeout=5,
    check=ConnectionPool.check_connection,
    configure=_configure_conn,
    kwargs={"row_factory": dict_row},
)


def get_db_connection():
    """Direct connection — used only by init_db, which runs before the pool is warm."""
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def execute_query(query, params=None, fetch=True):
    """Central data access utility. Every route handler calls this — do not add business logic here."""
    with pool.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            if fetch:
                return cursor.fetchall()
            return cursor.rowcount


def complete_and_unlock_node(user_id: str, node_id: str) -> list | None:
    """Mark a node completed and unlock its neighbors in a single atomic transaction."""
    complete_query = """
        UPDATE user_nodes
        SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s AND node_id = %s
        RETURNING neighbors
    """
    unlock_query = """
        UPDATE user_nodes
        SET is_unlocked = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s AND node_id = ANY(%s)
    """
    with pool.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(complete_query, (user_id, node_id))
            result = cursor.fetchall()
            if not result:
                return None
            neighbors = result[0]['neighbors'] or []
            if neighbors:
                cursor.execute(unlock_query, (user_id, neighbors))
    return neighbors


def init_db():
    """Initialize database with tables"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        print("Creating UUID extension...")
        cursor.execute("""
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
        """)
        print("UUID extension created!")

        print("Creating users table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                picture TEXT,
                google_id VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Users table created!")

        print("Creating user_nodes table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_nodes (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                node_id VARCHAR(255) NOT NULL,
                neighbors TEXT[] DEFAULT '{}',
                is_completed BOOLEAN DEFAULT FALSE,
                curiosity_score INTEGER DEFAULT 0,
                is_unlocked BOOLEAN DEFAULT FALSE,
                chat_history JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, node_id)
            )
        """)
        print("User_nodes table created!")

        conn.commit()
        conn.close()
        print("Database initialized successfully!")

    except Exception as e:
        print(f"ERROR in init_db: {e}")
        import traceback
        traceback.print_exc()
        conn.close()
        raise
