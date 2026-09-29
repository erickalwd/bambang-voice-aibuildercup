"""Abuse limits for the public deployment: who may connect, and how much."""
import os
import time
from collections import defaultdict, deque
from urllib.parse import urlparse


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


# Cross-origin callers allowed in addition to same-origin (production is served
# same-origin behind Caddy, so this only matters for `next dev` on port 3000).
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()
]

MAX_SESSIONS_TOTAL = _int_env("MAX_SESSIONS_TOTAL", 5)
MAX_SESSIONS_PER_IP = _int_env("MAX_SESSIONS_PER_IP", 2)
MAX_SESSION_SECONDS = _int_env("MAX_SESSION_SECONDS", 600)
SEARCH_PER_MINUTE = _int_env("SEARCH_PER_MINUTE", 20)
SUGGESTIONS_PER_MINUTE = _int_env("SUGGESTIONS_PER_MINUTE", 30)


def origin_allowed(origin: str | None, host: str | None) -> bool:
    """Browsers always send Origin on WebSockets; accept same-origin or an allowed origin."""
    if not origin:
        return False
    if origin in ALLOWED_ORIGINS:
        return True
    return bool(host) and urlparse(origin).netloc == host


class RateLimiter:
    """In-memory sliding window per key (fine for a single backend process)."""

    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True


class SessionCounter:
    """Tracks live voice sessions globally and per client IP."""

    def __init__(self):
        self.per_ip: dict[str, int] = defaultdict(int)

    @property
    def total(self) -> int:
        return sum(self.per_ip.values())

    def try_acquire(self, ip: str) -> str | None:
        """Returns None on success, or the reason the session was refused."""
        if self.total >= MAX_SESSIONS_TOTAL:
            return "busy"
        if self.per_ip[ip] >= MAX_SESSIONS_PER_IP:
            return "too_many_sessions"
        self.per_ip[ip] += 1
        return None

    def release(self, ip: str):
        self.per_ip[ip] -= 1
        if self.per_ip[ip] <= 0:
            del self.per_ip[ip]
