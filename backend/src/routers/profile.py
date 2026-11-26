from typing import Annotated, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session
from starlette import status

from src.database.db import get_db
from src.routers.login import bcrypt_context, get_current_user
from src.schemas.user import User

router = APIRouter(
    prefix="/api/profile",
    tags=["profile"],
)

db_dependency = Annotated[Session, Depends(get_db)]
current_user_dependency = Annotated[User, Depends(get_current_user)]


class SafeProfileResponse(BaseModel):
    user_id: Optional[str] = None
    campus: Optional[str] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    batch: Optional[str] = None
    bio: Optional[str] = None
    role: str


class ProfileUpdateRequest(BaseModel):
    campus: Optional[str] = Field(default=None, max_length=80)
    course: Optional[str] = Field(default=None, max_length=80)
    branch: Optional[str] = Field(default=None, max_length=80)
    batch: Optional[str] = Field(default=None, max_length=40)
    bio: Optional[str] = Field(default=None, max_length=300)

    @field_validator("campus", "course", "branch", "batch", "bio", mode="before")
    @classmethod
    def strip_strings(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed if trimmed else None
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("current_password", "new_password")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be empty or whitespace only.")
        return value


class AdminUserItem(BaseModel):
    id: int
    full_name: Optional[str] = None
    student_id: Optional[str] = None
    user_id: Optional[str] = None
    campus: Optional[str] = None
    role: str
    is_active: bool


class AdminUsersResponse(BaseModel):
    users: list[AdminUserItem]
    total: int


class SuspendUserRequest(BaseModel):
    is_active: bool


class SuspendUserResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    is_active: bool


def _require_admin(user: User) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


def _to_safe_profile(user: User) -> SafeProfileResponse:
    return SafeProfileResponse(
        user_id=user.user_id,
        campus=user.campus,
        course=user.course,
        branch=user.branch,
        batch=user.batch,
        bio=user.bio,
        role=user.role,
    )


@router.get("/me", response_model=SafeProfileResponse)
def get_safe_profile(user: current_user_dependency):
    """Return non-identifying profile fields for the authenticated user."""
    return _to_safe_profile(user)


@router.patch("/me", response_model=SafeProfileResponse)
def update_safe_profile(
    payload: ProfileUpdateRequest,
    db: db_dependency,
    user: current_user_dependency,
):
    """Update editable onboarding fields while keeping user_id locked."""
    updates = payload.model_dump(exclude_unset=True)
    if "campus" in updates and not updates["campus"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campus cannot be empty.",
        )

    for field, value in updates.items():
        setattr(user, field, value)

    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_safe_profile(user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: db_dependency,
    user: current_user_dependency,
):
    """Verify current password and update to a new password."""
    if not bcrypt_context.verify(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password.",
        )

    user.hashed_password = bcrypt_context.hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password updated successfully."}


@router.get("/users", response_model=AdminUsersResponse)
def list_users_for_admin(
    db: db_dependency,
    user: current_user_dependency,
    search: Optional[str] = Query(default=None, max_length=80),
    status_filter: Literal["all", "active", "suspended"] = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Admin-only endpoint to search, filter, and paginate users."""
    _require_admin(user)

    query = db.query(User)

    if status_filter == "active":
        query = query.filter(User.is_active.is_(True))
    elif status_filter == "suspended":
        query = query.filter(User.is_active.is_(False))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.user_id.ilike(term),
                User.full_name.ilike(term),
                User.student_id.ilike(term),
            )
        )

    total = query.count()
    rows = query.order_by(User.created_at.desc(), User.id.desc()).offset(offset).limit(limit).all()

    return AdminUsersResponse(
        users=[
            AdminUserItem(
                id=row.id,
                full_name=row.full_name,
                student_id=row.student_id,
                user_id=row.user_id,
                campus=row.campus,
                role=row.role,
                is_active=bool(row.is_active),
            )
            for row in rows
        ],
        total=total,
    )


@router.patch("/users/{target_user_id}/suspend", response_model=SuspendUserResponse)
def set_user_active_status(
    target_user_id: int,
    payload: SuspendUserRequest,
    db: db_dependency,
    user: current_user_dependency,
):
    """Admin-only endpoint to block (suspend) or unblock a user."""
    _require_admin(user)

    if target_user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot suspend or unblock your own account.",
        )

    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    target_user.is_active = payload.is_active
    db.add(target_user)
    db.commit()
    db.refresh(target_user)

    return SuspendUserResponse(
        id=target_user.id,
        user_id=target_user.user_id,
        is_active=bool(target_user.is_active),
    )
