from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request
from app.services.session_tracker import SessionTracker
from app.core.redis import redis_client
import logging

logger = logging.getLogger(__name__)

# Initialize session tracker
session_tracker = SessionTracker(redis_client)


class SessionValidatorMiddleware(BaseHTTPMiddleware):
    """
    Session validator middleware that tracks session activity and manages session lifecycle.
    This middleware runs AFTER rate limiting to only track activity for allowed requests.
    """

    async def dispatch(self, request: Request, call_next):
        """
        Validate and update session information for API endpoints

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain

        Returns:
            HTTP response
        """
        # Only apply session tracking to API routes, except session creation, session status, and output retrieval
        # SECURITY: Always skip OPTIONS requests for CORS preflight
        if (
            request.method == "OPTIONS"
            or not request.url.path.startswith("/api/")
            or request.url.path == "/api/auth/session"
            or request.url.path.startswith("/api/auth/session/")
            or request.url.path.startswith("/api/sanitize/outputs/")
        ):
            return await call_next(request)

        # Extract session ID from header (accept both variations)
        session_id = request.headers.get("session-id") or request.headers.get(
            "X-Session-ID"
        )

        # Also allow requests that have a valid processing ID (for sanitize endpoints)
        processing_id = request.headers.get("processing-id") or request.headers.get(
            "X-Processing-ID"
        )

        # If this is a sanitize endpoint and has processing ID, allow it
        if (
            request.url.path.startswith("/api/sanitize/")
            and processing_id
            and session_id
        ):
            return await call_next(request)

        if not session_id:
            # This should be caught by rate limit middleware, but handle gracefully
            logger.warning(
                f"Missing session-id header in session validator for {request.client.host if request.client else 'unknown'}"
            )
            return JSONResponse(
                status_code=400, content={"detail": "Session ID missing"}
            )

        try:
            # Update session activity (creates session if first time)
            session_data = await session_tracker.update_session_activity(session_id)

            # Increment request counter
            request_count = await session_tracker.increment_session_requests(session_id)

            logger.debug(
                f"Session {session_id} updated: request_count={request_count}, last_active={session_data.get('last_active')}"
            )

            # Continue to next middleware/endpoint
            response = await call_next(request)

            # Add session information to response headers for debugging
            response.headers["X-Session-Requests"] = str(request_count)
            response.headers["X-Session-Status"] = session_data.get(
                "pipeline_status", "idle"
            )

            return response

        except Exception as e:
            logger.error(f"Session validation error for session {session_id}: {str(e)}")
            # Fail open: allow request if Redis is down, but log the error
            logger.warning("Session validation failed, allowing request (fail open)")
            return await call_next(request)
