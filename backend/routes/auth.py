from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests
import os
from database import execute_query
import jwt
from datetime import datetime, timedelta

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

class GoogleLoginRequest(BaseModel):
    credential: str

@router.post("/google")
async def google_login(request: GoogleLoginRequest):
    """
    Login flow:
    1. User clicks "Sign in with Google" → Google popup appears
    2. User authenticates → Google returns credential token
    3. Frontend sends credential to /auth/google
    4. Backend verifies with Google
    5. Backend checks if user exists, creates if new
    6. Backend creates JWT token
    7. Returns token + user data to frontend
    8. Frontend stores token in localStorage
    """
    try:
        print(f"Received credential: {request.credential[:50]}...")
        
        # Verify Google token
        idinfo = id_token.verify_oauth2_token(
            request.credential, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        print(f"Token verified. User email: {idinfo['email']}")
        
        # Extract user info from verified Google token
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        google_id = idinfo['sub']
        
        print(f"Checking if user exists: {email}")
        
        # Check if user exists in database
        query = "SELECT * FROM users WHERE email = %s"
        existing_user = execute_query(query, (email,))
        
        if existing_user:
            # User exists - use existing data
            print(f"User found: {existing_user[0]}")
            user_id = existing_user[0]['id']
            user_data = existing_user[0]
        else:
            # New user - create in database
            print(f"Creating new user: {email}")
            insert_query = """
                INSERT INTO users (email, name, picture, google_id)
                VALUES (%s, %s, %s, %s)
                RETURNING id, email, name, picture
            """
            result = execute_query(insert_query, (email, name, picture, google_id))
            print(f"User created: {result[0]}")
            user_id = result[0]['id']
            user_data = result[0]
        
        # Create JWT token (valid for 7 days)
        token_data = {
            "sub": str(user_id),
            "email": email,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        access_token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        print(f"Returning user data and token")
        
        # Return token and user data to frontend
        return {
            "access_token": access_token,
            "user": {
                "id": str(user_data['id']),
                "email": user_data['email'],
                "name": user_data['name'],
                "picture": user_data['picture']
            }
        }
        
    except ValueError as e:
        # Google token verification failed
        print(f"ValueError: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        # General error
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me")
async def get_current_user(authorization: str = Header(None)):
    """
    Verify token and return current user data.
    
    Called when:
    - User refreshes the page (checks if token is still valid)
    - User navigates to a new page
    
    Token expires after 7 days, then user must sign in again.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Decode and verify JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        
        print(f"Decoded token, user_id: {user_id}")
        
        # Fetch user from database
        query = "SELECT id, email, name, picture FROM users WHERE id = %s"
        user = execute_query(query, (user_id,))
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return user data to frontend
        return {
            "id": str(user[0]['id']),
            "email": user[0]['email'],
            "name": user[0]['name'],
            "picture": user[0]['picture']
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        print(f"Error in get_current_user: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")