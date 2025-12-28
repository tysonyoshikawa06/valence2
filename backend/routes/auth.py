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

# User clicks "Sign in with Google" → Google popup appears
# User authenticates with Google → Google returns credential token
# Frontend sends credential to /auth/google
# Backend verifies with Google (line 29-33) 
# Backend checks if user exists (line 47-48)
# If new user, creates in database (line 57-62)
# Backend creates JWT token (line 68-76)
# Returns token + user data to frontend
# Frontend stores token in localStorage
@router.post("/google")
async def google_login(request: GoogleLoginRequest):
    try:
        print(f"Received credential: {request.credential[:50]}...")
        
        # Verify Google login request
        idinfo = id_token.verify_oauth2_token(
            request.credential, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        print(f"Token verified. User email: {idinfo['email']}")  # Debug
        
        # Extract user info from verified Google token
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        google_id = idinfo['sub']
                
        # Check if user exists in database
        query = "SELECT * FROM users WHERE email = %s"
        existing_user = execute_query(query, (email,))
        
        # If user exists in db
        if existing_user:
            print(f"User found: {existing_user[0]}")  # Debug
        else:
            print(f"Creating new user: {email}")  # Debug
            # Create new user
            insert_query = """
                INSERT INTO users (email, name, picture, google_id)
                VALUES (%s, %s, %s, %s)
                RETURNING id, email, name, picture
            """
            result = execute_query(insert_query, (email, name, picture, google_id))
            print(f"User created: {result[0]}")  # Debug
        user_id = existing_user[0]['id']
        user_data = existing_user[0]
        
        # Create JWT token
        token_data = {
            "sub": str(user_id),
            "email": email,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        access_token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
                
        # FastAPI converts dict to json and returns to frontend
        return {
            "access_token": access_token,
            "user": {
                "id": str(user_data['id']),
                "email": user_data['email'],
                "name": user_data['name'],
                "picture": user_data['picture']
            }
        }
    # Google token verification failure
    except ValueError as e:
        print(f"ValueError: {e}")  # Debug
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    # General error
    except Exception as e:
        print(f"Error: {e}")  # Debug
        import traceback
        traceback.print_exc()  # Print full stack trace
        raise HTTPException(status_code=500, detail=str(e))

# Handles refresh by checking local storage for user
# JWT token expires in 7 days. If outdated, user must sign in again
@router.get("/me")
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
                
        query = "SELECT id, email, name, picture FROM users WHERE id = %s"
        user = execute_query(query, (user_id,))
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Returns user data back to frontend
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