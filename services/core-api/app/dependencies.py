from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as firebase_auth
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User


def _unauthorized(message: str = "Invalid or expired authentication token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
    )


def extract_bearer_token(authorization: str) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Authorization header must use Bearer token")
    return token


def verify_firebase_token_from_header(authorization: str) -> dict[str, Any]:
    token = extract_bearer_token(authorization)

    try:
        return firebase_auth.verify_id_token(token, check_revoked=False)
    except Exception as exc:
        raise _unauthorized() from exc


async def get_user_by_firebase_uid(
    db: AsyncSession,
    firebase_uid: str,
) -> User | None:
    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    return result.scalar_one_or_none()


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    claims = verify_firebase_token_from_header(authorization)
    user = await get_user_by_firebase_uid(db, claims["uid"])

    if user is None or user.deleted_at is not None:
        raise _unauthorized("Authenticated user was not found")

    await db.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(user.id)},
    )
    return user


def require_role(*roles: str) -> Callable[..., Any]:
    async def dependency(
        user: User = Depends(get_current_user),
    ) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )
        return user

    return dependency