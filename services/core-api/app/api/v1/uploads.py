"""
app/api/v1/uploads.py

POST /uploads/signed-url  — returns a pre-signed URL for direct client upload.

Production  : generates a real GCS signed URL (15-min expiry).
Local dev   : returns a URL pointing to PUT /api/v1/uploads/local/{key},
              a simple file-receiver endpoint on this same server.
              No GCS credentials required for local development.

Detection   : if GCS_UPLOADS_BUCKET env var is set → GCS mode, else → local mode.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.dependencies import get_current_user, require_role
from app.models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

_UPLOAD_DIR = Path("/app/uploads")
_ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/heic",
    "image/gif", "application/pdf",
}
_MAX_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB
_GCS_BUCKET = os.getenv("GCS_UPLOADS_BUCKET", "")
_EXPIRY_MINUTES = 15


# ── Request / Response schemas ─────────────────────────────────────────────

class SignedUrlRequest(BaseModel):
    content_type: str
    filename: str
    purpose: Literal["submission", "completion"]


class SignedUrlResponse(BaseModel):
    upload_url: str
    object_key: str
    public_url: str
    expires_at: str


# ── GCS helper ─────────────────────────────────────────────────────────────

def _gcs_signed_url(object_key: str, content_type: str) -> tuple[str, str]:
    """
    Returns (signed_upload_url, public_url).
    Requires google-cloud-storage and appropriate credentials.
    """
    from google.cloud import storage  # type: ignore

    client = storage.Client()
    bucket = client.bucket(_GCS_BUCKET)
    blob = bucket.blob(object_key)

    upload_url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=_EXPIRY_MINUTES),
        method="PUT",
        content_type=content_type,
    )
    public_url = f"https://storage.googleapis.com/{_GCS_BUCKET}/{object_key}"
    return upload_url, public_url


# ── POST /uploads/signed-url ───────────────────────────────────────────────

@router.post("/signed-url", response_model=SignedUrlResponse, status_code=status.HTTP_200_OK)
async def get_signed_url(
    body: SignedUrlRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SignedUrlResponse:
    if body.content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported content_type '{body.content_type}'. "
                   f"Allowed: {', '.join(sorted(_ALLOWED_MIME))}",
        )

    # Enforce path prefix per purpose — volunteers can't write to submissions/ and vice versa
    now = datetime.now(timezone.utc)
    unique = uuid.uuid4().hex[:12]
    safe_name = Path(body.filename).name  # strip any path traversal

    if body.purpose == "submission":
        object_key = f"submissions/{now.year}/{now.month:02d}/{now.day:02d}/{unique}/{safe_name}"
    else:  # completion
        object_key = f"task-completion/{unique}/{safe_name}"

    expires_at = (now + timedelta(minutes=_EXPIRY_MINUTES)).isoformat()

    if _GCS_BUCKET:
        # ── Production: real GCS signed URL ─────────────────────────────────
        try:
            upload_url, public_url = _gcs_signed_url(object_key, body.content_type)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Could not generate GCS signed URL: {exc}",
            )
    else:
        # ── Local dev: point at our own upload receiver ──────────────────────
        base_url = str(request.base_url).rstrip("/")
        safe_key = object_key.replace("/", "_")   # flatten for the local endpoint
        upload_url = f"{base_url}/api/v1/uploads/local/{safe_key}"
        public_url = f"{base_url}/api/v1/uploads/file/{safe_key}"

    return SignedUrlResponse(
        upload_url=upload_url,
        object_key=object_key,
        public_url=public_url,
        expires_at=expires_at,
    )


# ── Local dev upload receiver ──────────────────────────────────────────────
# These two endpoints are only used when GCS_UPLOADS_BUCKET is not set.

@router.put("/local/{key}", status_code=status.HTTP_200_OK, include_in_schema=False)
async def local_upload_receiver(key: str, request: Request) -> dict:
    """Receives a raw PUT body and saves it to /app/uploads/local/{key}."""
    data = await request.body()
    if len(data) > _MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit",
        )
    dest = _UPLOAD_DIR / "local"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / key).write_bytes(data)
    return {"status": "ok", "key": key, "size": len(data)}


@router.get("/file/{key}", include_in_schema=False)
async def local_file_serve(key: str) -> Response:
    """Serves a previously uploaded local file."""
    fp = _UPLOAD_DIR / "local" / key
    if not fp.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Basic content-type sniffing from extension
    ext = fp.suffix.lower()
    mime_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
        ".pdf": "application/pdf", ".heic": "image/heic",
    }
    content_type = mime_map.get(ext, "application/octet-stream")
    return Response(content=fp.read_bytes(), media_type=content_type)