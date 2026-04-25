import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.v1.admin import router as admin_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.auth import router as auth_router
from app.api.v1.assignments import router as assignments_router
from app.api.v1.cron import router as cron_router
from app.api.v1.needs import router as needs_router
from app.api.v1.submissions import router as submissions_router
from app.api.v1.uploads import router as uploads_router
from app.api.v1.reports import router as reports_router
from app.api.v1.volunteers import router as volunteers_router
from app.utils.firebase import init_firebase_admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


# ── Security headers middleware ───────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = FastAPI(
    title="Nectaid API",
    version="0.4.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,        prefix="/api/v1")
app.include_router(volunteers_router,  prefix="/api/v1")
app.include_router(needs_router,       prefix="/api/v1")
app.include_router(submissions_router, prefix="/api/v1")
app.include_router(assignments_router, prefix="/api/v1")
app.include_router(uploads_router,     prefix="/api/v1")
app.include_router(analytics_router,   prefix="/api/v1")
app.include_router(cron_router,           prefix="/api/v1")
app.include_router(notifications_router,  prefix="/api/v1")
app.include_router(admin_router,          prefix="/api/v1")
app.include_router(reports_router,        prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "core-api", "version": "0.4.0"}


@app.get("/")
async def root():
    return {"message": "Nectaid API v0.3.0", "docs": "/api/v1/docs"}


@app.on_event("startup")
async def startup_event():
    init_firebase_admin()
    logger.info("Starting Nectaid API...")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Nectaid API...")