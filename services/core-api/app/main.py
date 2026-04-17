from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Nectaid API",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "core-api", "version": "0.1.0"}


@app.get("/")
async def root():
    return {"message": "Nectaid API v0.1.0", "docs": "/api/v1/docs"}


@app.on_event("startup")
async def startup_event():
    logger.info("Starting Nectaid API...")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Nectaid API...")
