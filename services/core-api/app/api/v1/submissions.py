from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import RawSubmission, User
from app.schemas.submission import SubmissionCreate, SubmissionResponse


router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    payload: SubmissionCreate,
    current_user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    submission = RawSubmission(
        source="webform",
        submitted_by=current_user.id,
        submitter_phone=payload.submitter_phone,
        raw_text=payload.raw_text,
        image_urls=payload.image_urls,
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
