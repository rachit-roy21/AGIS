from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.sanitize import router as sanitize_router
from app.api.debate import router as debate_router
from app.middleware.rate_limit_middleware import RateLimitMiddleware
from app.middleware.session_validator import SessionValidatorMiddleware

from app.core.database import engine, Base
import app.models.session
import app.models.audit_log
import app.models.sanitized_output
import app.models.debate

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VaultSim API")

# Register middleware in correct order (Outermost to Innermost):
# 1. CORSMiddleware (MUST be outermost for preflights)
# 2. RateLimitMiddleware
# 3. SessionValidatorMiddleware

app.add_middleware(RateLimitMiddleware)
app.add_middleware(SessionValidatorMiddleware)

# CORS middleware - Explicitly allow common origins and expose internal headers
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://geminihackathon26-production.up.railway.app",
    "https://gemini-hackathon-orpin.vercel.app",
    "https://gemini-hackathon-26-frontend.vercel.app",
    "https://frontend-gemini-hack.vercel.app",
    "https://vault-8zsk.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Session-ID",
        "X-Processing-ID",
        "X-Requested-With",
        "session-id",
        "processing-id",
    ],
    expose_headers=[
        "X-Tokens", 
        "X-Pages", 
        "X-Processing-Time", 
        "X-Gemini-Calls", 
        "X-Processing-ID",
        "X-Session-Requests",
        "X-Session-Status",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Content-Disposition"
    ],
)

# Register API routes
app.include_router(sanitize_router)
app.include_router(auth_router)
app.include_router(debate_router)


@app.get("/")
def root():
    return {"status": "API running"}


@app.get("/api/health")
def health_check():
    """Health check endpoint for frontend monitoring"""
    return {"status": "healthy", "service": "VaultSim API", "version": "1.0.0"}
