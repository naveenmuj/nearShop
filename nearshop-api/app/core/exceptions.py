from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message=message, status_code=404)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message=message, status_code=401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Not authorized"):
        super().__init__(message=message, status_code=403)


class BadRequestError(AppException):
    def __init__(self, message: str = "Bad request"):
        super().__init__(message=message, status_code=400)


class RateLimitError(AppException):
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(message=message, status_code=429)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    headers = {}
    if isinstance(exc, RateLimitError):
        headers["Retry-After"] = str(exc.retry_after)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
        headers=headers,
    )
