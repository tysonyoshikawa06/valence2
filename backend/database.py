import os
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """Get a database connection"""
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    return conn

def execute_query(query, params=None, fetch=True):
    """Central data access utility. Every route handler calls this — do not add business logic here."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query, params)

        if fetch:
            result = cursor.fetchall()
            conn.commit()
            conn.close()
            return result
        else:
            conn.commit()
            conn.close()
            return cursor.rowcount
    except Exception as e:
        conn.close()
        raise e


def complete_and_unlock_node(user_id: str, node_id: str) -> list | None:
    """Mark a node completed and unlock its neighbors.

    Returns the list of unlocked neighbor IDs, or None if the node was not found.
    """
    complete_query = """
        UPDATE user_nodes
        SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s AND node_id = %s
        RETURNING neighbors
    """
    result = execute_query(complete_query, (user_id, node_id))
    if not result:
        return None

    neighbors = result[0]['neighbors'] or []
    if neighbors:
        unlock_query = """
            UPDATE user_nodes
            SET is_unlocked = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND node_id = ANY(%s)
        """
        execute_query(unlock_query, (user_id, neighbors), fetch=False)
    return neighbors

def init_db():
    """Initialize database with tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Enable UUID extension
        print("Creating UUID extension...")
        cursor.execute("""
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
        """)
        print("UUID extension created!")
        
        # Create users table with UUID
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
        
        # Create user_nodes table
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