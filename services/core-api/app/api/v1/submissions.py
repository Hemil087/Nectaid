from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import RawSubmission, User
from app.schemas.submission import SubmissionResponse

router = APIRouter(prefix="/submissions", tags=["submissions"])

_UPLOAD_DIR = Path("/app/uploads")
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per file
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    raw_text: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    current_user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    if not raw_text and not any(f.filename for f in files):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide raw_text, at least one image, or both.",
        )

    sub_id = uuid.uuid4()
    image_urls: list[str] = []

    for f in files:
        if not f.filename:
            continue
        if f.content_type and f.content_type not in _ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {f.content_type}",
            )
        data = await f.read()
        if len(data) > _MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{f.filename} exceeds 10 MB limit.",
            )
        dest_dir = _UPLOAD_DIR / str(sub_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / f.filename).write_bytes(data)
        image_urls.append(f"/uploads/{sub_id}/{f.filename}")

    submission = RawSubmission(
        id=sub_id,
        source="webform",
        submitted_by=current_user.id,
        raw_text=raw_text or None,
        image_urls=image_urls if image_urls else None,
        status="received",
    )
    db.add(submission)
    await db.flush()
    await db.refresh(submission)

    return SubmissionResponse(
        id=submission.id,
        status=submission.status,
        created_at=submission.created_at,
    )
