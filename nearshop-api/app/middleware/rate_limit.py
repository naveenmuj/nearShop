import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-based sliding window rate limiter."""

    # Configure limits per path prefix
    LIMITS = {
        "/api/v1/ai/search/visual": {"requests": 5, "window": 86400},  # 5/day
        "/api/v1/products/search": {"requests": 30, "window": 60},      # 30/min
        "/api/v1/shops/search": {"requests": 30, "window": 60},
        "/api/v1/auth/send-otp": {"requests": 5, "window": 300},        # 5 per 5min
        "default": {"requests": 300, "window": 60},                      # 300/min
    }

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/api/v1/health":
            return await call_next(request)

        # Determine client identifier
        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", None)
        identifier = user_id or client_ip

        # Find matching limit
        limit_config = self.LIMITS.get("default")
        for path_prefix, config in self.LIMITS.items():
            if path_prefix != "default" and request.url.path.startswith(path_prefix):
                limit_config = config
                break

        max_requests = limit_config["requests"]
        window = limit_config["window"]

        # Check rate limit using Redis sliding window
        try:
            from app.core.redis import get_redis_client
            redis = get_redis_client()
            key = f"ratelimit:{identifier}:{request.url.path}:{int(time.time()) // window}"

            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, window)

            if current > max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded"},
                    headers={"Retry-After": str(window)},
                )
            await redis.aclose()
        except Exception:
            # If Redis is down, allow the request through
            pass

        response = await call_next(request)
        return response
