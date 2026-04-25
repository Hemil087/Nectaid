from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal, get_db
from app.dependencies import require_role
from app.models import RawSubmission, User
from app.schemas.submission import SubmissionResponse
from app.services.embedding import embed_need_text
from app.services.extraction import extract_need
from app.services.firestore_sync import sync_firestore
from app.services.needs_service import create_need_from_extraction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/submissions", tags=["submissions"])

_UPLOAD_DIR = Path("/app/uploads")
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per file
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


async def _run_ingestion(
    submission_id: str,
    raw_text: str | None,
    image_urls: list[str],
) -> None:
    """Background pipeline: extract → create need → mark extracted/failed."""
    sub_id = uuid.UUID(submission_id)

    # Phase 1 — mark processing so the UI can show in-progress state
    async with SessionLocal() as db:
        sub = await db.get(RawSubmission, sub_id)
        if sub is None:
            logger.error("ingestion_failed: submission %s not found", submission_id)
            return
        sub.status = "processing"
        await db.commit()

    # Phase 2 — extract and persist the need
    async with SessionLocal() as db:
        try:
            images: list[bytes] = []
            for url in image_urls:
                fp = Path("/app") / url.lstrip("/")
                if fp.exists():
                    images.append(fp.read_bytes())

            extracted = await extract_need(raw_text or "", images)
            need = await create_need_from_extraction(db, submission_id, extracted)

            try:
                embed_text = (
                    f"{extracted.title}. {extracted.description_en}. "
                    f"Requires: {', '.join(extracted.required_skills or [])}."
                )
                need.embedding = await embed_need_text(embed_text)
            except Exception as emb_exc:
                logger.error("embedding_failed need=%s: %s", need.id, emb_exc)

            sub = await db.get(RawSubmission, sub_id)
            sub.status = "extracted"
            sub.extracted_need_id = need.id
            sub.processed_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info("ingestion_ok submission=%s need=%s", submission_id, need.id)

            # Sync to Firestore (non-fatal)
            await sync_firestore("needs", str(need.id), db)
            org_id: str | None = None
            if sub.submitted_by:
                submitter = await db.get(User, sub.submitted_by)
                if submitter and submitter.org_id:
                    org_id = str(submitter.org_id)
            if org_id:
                await sync_firestore(
                    "coordinator_feed", str(uuid.uuid4()), db,
                    org_id=org_id,
                    event_type="need_created",
                    extra={
                        "need_id": str(need.id),
                        "title": need.title,
                        "urgency": need.urgency,
                        "need_type": need.need_type,
                    },
                )

        except Exception as exc:
            await db.rollback()
            error_msg = str(exc)[:2000]
            logger.error("ingestion_failed submission=%s: %s", submission_id, error_msg)

            async with SessionLocal() as err_db:
                sub = await err_db.get(RawSubmission, sub_id)
                if sub:
                    sub.status = "failed"
                    sub.extraction_error = error_msg
                    await err_db.commit()


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    background_tasks: BackgroundTasks,
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

    background_tasks.add_task(
        _run_ingestion,
        str(submission.id),
        raw_text,
        image_urls,
    )

    return SubmissionResponse(
        id=submission.id,
        status=submission.status,
        created_at=submission.created_at,
    )
