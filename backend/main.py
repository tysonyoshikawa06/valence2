import asyncio
import sys

# ProactorEventLoop (Windows default) raises WinError 10054 on normal client
# disconnects. SelectorEventLoop handles it silently. No effect on Linux.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from database import init_db, pool
from limiter import limiter
from routes import auth, chat, graph
from dotenv import load_dotenv
import os

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
PORT = int(os.getenv("PORT", 8000))

# Support comma-separated list of allowed origins for multi-env setups
allowed_origins = [url.strip() for url in FRONTEND_URL.split(",") if url.strip()]

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open(wait=True)
    init_db()
    yield
    pool.close()

app = FastAPI(title="Knowledge Graph API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(graph.router, prefix="/api", tags=["graph"])

@app.get("/")
async def root():
    return {"message": "Knowledge Graph API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)