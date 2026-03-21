from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class OptionalAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from app.core.security import verify_access_token
                token = auth_header.split(" ", 1)[1]
                payload = verify_access_token(token)
                request.state.user_id = payload.get("sub")
            except Exception:
                pass  # Optional — don't block the request
        response = await call_next(request)
        return response
