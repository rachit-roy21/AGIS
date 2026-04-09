import redis.asyncio as redis
from datetime import datetime
from typing import Optional, Dict, Any
from app.core.config import settings


class SessionTracker:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.session_ttl = settings.SESSION_TIMEOUT_MINUTES * 60  # Convert to seconds

    async def update_session_activity(self, session_id: str) -> Dict[str, Any]:
        """
        Update session activity with current timestamp
        Creates session if it doesn't exist

        Args:
            session_id: Unique session identifier

        Returns:
            Dict with session data
        """
        key = f"session:{session_id}"
        current_time = datetime.utcnow().isoformat()

        # Check if session exists
        exists = await self.redis.exists(key)

        if not exists:
            # Create new session
            await self.redis.hset(
                key,
                mapping={
                    "created_at": current_time,
                    "last_active": current_time,
                    "requests": "0",
                    "pipeline_status": "idle",
                },
            )
        else:
            # Update existing session activity
            await self.redis.hset(key, "last_active", current_time)

        # Apply TTL to ensure session expires after inactivity
        await self.redis.expire(key, self.session_ttl)

        return await self.get_session_data(session_id)

    async def increment_session_requests(self, session_id: str) -> int:
        """
        Increment the total request counter for a session

        Args:
            session_id: Unique session identifier

        Returns:
            New request count
        """
        key = f"session:{session_id}"

        # Increment requests counter
        await self.redis.hincrby(key, "requests", 1)

        # Refresh TTL on activity
        await self.redis.expire(key, self.session_ttl)

        # Return updated request count
        requests_str = await self.redis.hget(key, "requests")
        return int(requests_str) if requests_str else 1

    async def set_pipeline_status(self, session_id: str, status: str) -> bool:
        """
        Set pipeline status for a session

        Args:
            session_id: Unique session identifier
            status: Pipeline status ('idle', 'running', 'error')

        Returns:
            True if successful, False if session doesn't exist
        """
        key = f"session:{session_id}"

        # Check if session exists
        if not await self.redis.exists(key):
            return False

        # Update pipeline status
        await self.redis.hset(key, "pipeline_status", status)

        # Refresh TTL
        await self.redis.expire(key, self.session_ttl)

        return True

    async def get_pipeline_status(self, session_id: str) -> Optional[str]:
        """
        Get current pipeline status for a session

        Args:
            session_id: Unique session identifier

        Returns:
            Pipeline status or None if session doesn't exist
        """
        key = f"session:{session_id}"

        if not await self.redis.exists(key):
            return None

        status = await self.redis.hget(key, "pipeline_status")
        return status.decode("utf-8") if status else "idle"

    async def session_exists(self, session_id: str) -> bool:
        """
        Check if session exists in Redis

        Args:
            session_id: Unique session identifier

        Returns:
            True if session exists, False otherwise
        """
        key = f"session:{session_id}"
        return await self.redis.exists(key) > 0

    async def get_session_data(self, session_id: str) -> Dict[str, Any]:
        """
        Get complete session data

        Args:
            session_id: Unique session identifier

        Returns:
            Dict with session data or empty dict if not found
        """
        key = f"session:{session_id}"

        if not await self.redis.exists(key):
            return {}

        # Get all session fields
        session_data = await self.redis.hgetall(key)

        # Convert bytes to strings and parse integers
        result = {}
        for field, value in session_data.items():
            field_str = field.decode("utf-8")
            value_str = value.decode("utf-8")

            if field_str == "requests":
                result[field_str] = int(value_str)
            else:
                result[field_str] = value_str

        return result

    async def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions (manual cleanup if needed)
        Note: Redis TTL handles automatic cleanup

        Returns:
            Number of expired sessions found (for monitoring)
        """
        # This is mainly for monitoring - TTL handles automatic cleanup
        current_time = datetime.utcnow().timestamp()

        # Find all session keys
        pattern = "session:*"
        expired_count = 0

        async for key in self.redis.scan_iter(match=pattern):
            ttl = await self.redis.ttl(key)
            if ttl == -1:  # No TTL set (shouldn't happen in normal operation)
                # Check creation time and remove if very old
                session_data = await self.redis.hget(key, "created_at")
                if session_data:
                    try:
                        created_at = datetime.fromisoformat(
                            session_data.decode("utf-8")
                        )
                        if (current_time - created_at.timestamp()) > (
                            self.session_ttl * 2
                        ):
                            await self.redis.delete(key)
                            expired_count += 1
                    except (ValueError, AttributeError):
                        # Invalid date format, remove the key
                        await self.redis.delete(key)
                        expired_count += 1

        return expired_count

    async def get_active_sessions_count(self) -> int:
        """
        Get count of active sessions (monitoring)

        Returns:
            Number of active sessions
        """
        pattern = "session:*"
        count = 0

        async for key in self.redis.scan_iter(match=pattern):
            if await self.redis.exists(key):
                count += 1

        return count

    async def get_session_ttl(self, session_id: str) -> int:
        """
        Get remaining TTL for a session (monitoring)

        Args:
            session_id: Unique session identifier

        Returns:
            Remaining TTL in seconds, -1 if no TTL, -2 if session doesn't exist
        """
        key = f"session:{session_id}"
        return await self.redis.ttl(key)
