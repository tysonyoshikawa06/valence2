import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """Get a database connection"""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

def execute_query(query, params=None, fetch=True):
    """Execute a SQL query"""
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

def init_db():
    """Initialize database with tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
        """)
        
        # Create users table with UUID
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
        
        # Create user_nodes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_nodes (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                node_id VARCHAR(255) NOT NULL,
                neighbors TEXT[] DEFAULT '{}',
                is_completed BOOLEAN DEFAULT FALSE,
                curiosity_score INTEGER DEFAULT 0,
                is_unlocked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, node_id)
            )
        """)
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        print(f"ERROR in init_db: {e}")
        import traceback
        traceback.print_exc()
        conn.close()
        raise