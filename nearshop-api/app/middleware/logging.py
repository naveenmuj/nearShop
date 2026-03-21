import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = structlog.get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log request/response details with structlog."""

    # Paths to skip logging
    SKIP_PATHS = {"/api/v1/health", "/docs", "/openapi.json", "/favicon.ico"}

    # Sensitive fields to never log
    SENSITIVE_FIELDS = {"code", "otp", "token", "password", "secret", "access_token", "refresh_token"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        user_id = getattr(request.state, "user_id", None)

        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            client_ip=request.client.host if request.client else None,
        )

        return response
