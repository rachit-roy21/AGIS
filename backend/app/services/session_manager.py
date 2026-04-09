from sqlalchemy.orm import Session
from app.models.session import Session as SessionModel
from app.services.session_tracker import SessionTracker
from app.core.redis import redis_client
from datetime import datetime, timedelta
from app.core.config import settings
import secrets
import uuid


class SessionManager:
    def __init__(self, db: Session):
        self.db = db
        self.session_tracker = SessionTracker(redis_client)

    def create_session(self, ip_address: str, user_agent: str) -> dict:
        """
        Create new session with server challenge
        Returns: session_id and challenge for key derivation
        """
        session_id = uuid.uuid4()

        # Generate cryptographically secure challenge (256 bits)
        challenge = secrets.token_urlsafe(32)

        session = SessionModel(
            id=session_id,
            challenge=challenge,
            ip_address=ip_address,
            user_agent=user_agent,
            status="active",
        )

        self.db.add(session)
        self.db.commit()

        # Also create session in Redis for rate limiting and activity tracking
        session_id_str = str(session_id)
        import asyncio

        asyncio.create_task(
            self.session_tracker.update_session_activity(session_id_str)
        )
        asyncio.create_task(
            self.session_tracker.set_pipeline_status(session_id_str, "idle")
        )

        return {
            "session_id": session_id_str,
            "challenge": challenge,
            "expires_in": settings.SESSION_TIMEOUT_MINUTES * 60,  # seconds
        }

    def validate_session(self, session_id: str) -> bool:
        """Check if session is active and not expired"""
        try:
            session_uuid = uuid.UUID(session_id)
        except ValueError:
            return False

        session = (
            self.db.query(SessionModel).filter(SessionModel.id == session_uuid).first()
        )

        if not session or session.status != "active":
            return False

        # Check expiration
        timeout = timedelta(minutes=settings.SESSION_TIMEOUT_MINUTES)
        if datetime.utcnow() - session.last_active > timeout:
            self.terminate_session(session_id, reason="expired")
            return False

        # Update last_active
        session.last_active = datetime.utcnow()
        self.db.commit()

        # Also update Redis session activity
        import asyncio

        asyncio.create_task(self.session_tracker.update_session_activity(session_id))

        return True

    def get_session(self, session_id: str) -> SessionModel:
        """Get session object"""
        try:
            session_uuid = uuid.UUID(session_id)
        except ValueError:
            return None

        return (
            self.db.query(SessionModel).filter(SessionModel.id == session_uuid).first()
        )

    def terminate_session(self, session_id: str, reason: str = "user_terminated"):
        """Mark session as terminated"""
        session = self.get_session(session_id)
        if session:
            session.status = "terminated" if reason != "expired" else "expired"
            session.terminated_at = datetime.utcnow()
            self.db.commit()

            # Also update Redis session status and remove from tracking
            import asyncio

            asyncio.create_task(
                self.session_tracker.set_pipeline_status(session_id, "terminated")
            )

            # Delete session key from Redis to clean up immediately
            from app.core.redis import redis_client

            asyncio.create_task(redis_client.delete(f"session:{session_id}"))

    def cleanup_expired_sessions(self):
        """Cleanup old sessions (run periodically)"""
        cutoff = datetime.utcnow() - timedelta(hours=24)

        self.db.query(SessionModel).filter(
            SessionModel.created_at < cutoff,
            SessionModel.status.in_(["expired", "terminated"]),
        ).delete()

        self.db.commit()
