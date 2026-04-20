from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    get_current_user,
    get_user_by_firebase_uid,
    verify_firebase_token_from_header,
)
from app.models import User
from app.schemas.auth import SessionResponse


router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_role(claims_role: object) -> str:
    role = str(claims_role or "volunteer").lower()
    return role if role in {"volunteer", "coordinator", "admin"} else "volunteer"


def _session_response(user: User) -> SessionResponse:
    return SessionResponse(
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
        org_id=user.org_id,
    )


async def _find_or_create_user(
    authorization: str,
    db: AsyncSession,
) -> User:
    claims = verify_firebase_token_from_header(authorization)
    user = await get_user_by_firebase_uid(db, claims["uid"])

    if user and user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user was deleted",
        )

    if user is None:
        user = User(
            firebase_uid=claims["uid"],
            role=_normalize_role(claims.get("role")),
            full_name=claims.get("name") or claims.get("email") or claims["uid"],
            email=claims.get("email"),
            phone=claims.get("phone_number"),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    return user


@router.post(
    "/session",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
)
async def create_session(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    user = await _find_or_create_user(authorization, db)
    return _session_response(user)


@router.get(
    "/me",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    return _session_response(current_user)
