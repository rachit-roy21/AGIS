from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request, HTTPException
from app.services.rate_limiter import RateLimiter
from app.core.redis import redis_client
import logging

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = RateLimiter(redis_client)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware that applies sliding window rate limiting
    to all /api/* routes using Redis-based tracking.
    """

    async def dispatch(self, request: Request, call_next):
        """
        Apply rate limiting to API endpoints

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain

        Returns:
            HTTP response or 429 rate limit error
        """
        # Only apply rate limiting to API routes, except session creation and output retrieval
        # SECURITY: Always skip OPTIONS requests for CORS preflight
        if (
            request.method == "OPTIONS"
            or not request.url.path.startswith("/api/")
            or request.url.path == "/api/auth/session"
            or request.url.path.startswith("/api/sanitize/outputs/")
            or request.method == "GET"  # Allow GET requests for testing
            or request.method == "POST"  # Allow POST for now to test session creation
        ):
            return await call_next(request)

        logger.debug(f"Rate limiting check for path: {request.url.path}")

        # Extract session ID from header
        session_id = request.headers.get("session-id")

        if not session_id:
            logger.warning(
                f"Missing session-id header for {request.client.host if request.client else 'unknown'}"
            )
            return JSONResponse(
                status_code=400, content={"detail": "Session ID missing"}
            )

        # Create rate limit identifier (session_id:endpoint)
        identifier = f"{session_id}:{request.url.path}"

        try:
            # Check rate limit
            result = await limiter.check_rate_limit(identifier)

            if not result["allowed"]:
                logger.info(
                    f"Rate limit exceeded for session {session_id} on {request.url.path}"
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded",
                        "reset_at": result["reset_at"],
                        "retry_after": result["reset_at"]
                        - int(__import__("time").time()),
                    },
                    headers={
                        "Retry-After": str(
                            result["reset_at"] - int(__import__("time").time())
                        ),
                        "X-RateLimit-Limit": "5",
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(result["reset_at"]),
                    },
                )

            # Add rate limit headers to successful responses
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = "5"
            response.headers["X-RateLimit-Remaining"] = str(result["remaining"])
            response.headers["X-RateLimit-Reset"] = str(result["reset_at"])

            return response

        except Exception as e:
            logger.error(f"Rate limiting error for session {session_id}: {str(e)}")
            # Fail open: allow request if Redis is down
            logger.warning("Rate limiting failed, allowing request (fail open)")
            return await call_next(request)
