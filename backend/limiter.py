from slowapi import Limiter
from fastapi import Request


def get_real_ip(request: Request) -> str:
    """Read the real client IP forwarded by nginx (X-Real-IP), falling back gracefully."""
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_real_ip)
