import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.needs import router as needs_router
from app.api.v1.submissions import router as submissions_router
from app.api.v1.volunteers import router as volunteers_router
from app.utils.firebase import init_firebase_admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Nectaid API",
    version="0.2.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(volunteers_router, prefix="/api/v1")
app.include_router(needs_router, prefix="/api/v1")
app.include_router(submissions_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "core-api", "version": "0.2.0"}


@app.get("/")
async def root():
    return {"message": "Nectaid API v0.2.0", "docs": "/api/v1/docs"}


@app.on_event("startup")
async def startup_event():
    init_firebase_admin()
    logger.info("Starting Nectaid API...")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Nectaid API...")
