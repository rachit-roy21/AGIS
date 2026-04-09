import redis.asyncio as redis
import time
from datetime import datetime
from typing import Dict
from app.core.config import settings


class RateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.max_requests = settings.MAX_REQUESTS_PER_MINUTE
        self.window_seconds = 60

    async def check_rate_limit(self, identifier: str) -> Dict[str, int]:
        """
        Check if session is allowed to make request using sliding window algorithm

        Args:
            identifier: Unique identifier for rate limit (session_id:endpoint)

        Returns:
            Dict containing:
            - allowed: bool (whether request is allowed)
            - remaining: int (requests remaining in window)
            - reset_at: int (unix timestamp when window resets)
        """
        current_time = int(time.time())
        key = f"rate_limit:{identifier}"

        # Clean up old timestamps outside the 60-second window
        await self._clean_old_timestamps(key, current_time)

        # Count current requests in window
        request_count = await self.redis.zcard(key)

        if request_count >= self.max_requests:
            # Find oldest timestamp to calculate reset time
            oldest_request = await self.redis.zrange(key, 0, 0, withscores=True)
            reset_time = (
                int(oldest_request[0][1]) + self.window_seconds
                if oldest_request
                else current_time + self.window_seconds
            )

            return {"allowed": False, "remaining": 0, "reset_at": reset_time}

        # Add current request timestamp
        await self.redis.zadd(key, {str(current_time): current_time})

        # Set expiration on the sorted set to clean up stale data
        await self.redis.expire(key, self.window_seconds)

        # Calculate remaining requests
        remaining = self.max_requests - (request_count + 1)

        return {
            "allowed": True,
            "remaining": max(0, remaining),
            "reset_at": current_time + self.window_seconds,
        }

    async def _clean_old_timestamps(self, key: str, current_time: int):
        """
        Remove timestamps older than the sliding window

        Args:
            key: Redis key for rate limit data
            current_time: Current unix timestamp
        """
        cutoff_time = current_time - self.window_seconds
        await self.redis.zremrangebyscore(key, 0, cutoff_time)

    async def get_rate_limit_status(self, identifier: str) -> Dict[str, int]:
        """
        Get current rate limit status without consuming a request

        Args:
            identifier: Unique identifier for rate limit

        Returns:
            Dict containing current rate limit status
        """
        current_time = int(time.time())
        key = f"rate_limit:{identifier}"

        # Clean up old timestamps
        await self._clean_old_timestamps(key, current_time)

        # Count current requests
        request_count = await self.redis.zcard(key)

        return {
            "current_requests": request_count,
            "max_requests": self.max_requests,
            "remaining": max(0, self.max_requests - request_count),
            "window_seconds": self.window_seconds,
        }
