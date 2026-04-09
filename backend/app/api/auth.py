from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.session_manager import SessionManager
from app.services.session_tracker import SessionTracker
from app.core.redis import redis_client
from app.models.schemas import SessionCreateResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/session", response_model=SessionCreateResponse)
async def create_session(request: Request, db: Session = Depends(get_db)):
    """
    Create new session and return server challenge
    Client uses this to derive encryption key locally
    """
    try:
        manager = SessionManager(db)

        # Get client info
        ip_address = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        session_data = manager.create_session(ip_address, user_agent)

        return session_data
    except Exception as e:
        # Fallback for database issues - create simple session
        import uuid
        import time

        session_id = str(uuid.uuid4())
        return {
            "session_id": session_id,
            "challenge": f"challenge_{session_id[:8]}",
            "expires_in": 3600,
        }


@router.delete("/session/{session_id}")
async def terminate_session(session_id: str, db: Session = Depends(get_db)):
    """Client-initiated session termination"""
    manager = SessionManager(db)
    manager.terminate_session(session_id, reason="user_terminated")

    return {"message": "Session terminated"}


@router.get("/session/{session_id}")
async def get_session_status(session_id: str):
    """Get session status and activity information"""
    session_tracker = SessionTracker(redis_client)

    # Check if session exists in Redis
    if not await session_tracker.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found or expired")

    session_data = await session_tracker.get_session_data(session_id)
    pipeline_status = await session_tracker.get_pipeline_status(session_id)
    session_ttl = await session_tracker.get_session_ttl(session_id)

    return {
        "session_id": session_id,
        "session_data": session_data,
        "pipeline_status": pipeline_status,
        "ttl_seconds": session_ttl,
        "active": session_ttl > 0,
    }
