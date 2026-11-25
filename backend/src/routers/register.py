from fastapi import APIRouter, Depends, Query, status
from typing import Annotated
from sqlalchemy.orm import Session

from src.database.db import get_db
from src.schemas.user import User
from src.schemas.auth import (
    RegistrationStatusResponse,
    SendOTPRequest,
    VerifyOTPRequest,
    VerifyOTPResponse,
    CreateAccountRequest,
    CheckUserIdResponse,
    OnboardingRequest,
)
from src.services.email_service import get_email_service, BaseEmailService
from src.services.auth_service import AuthService
from src.routers.login import create_access_token, get_current_user, Token

router = APIRouter(
    prefix="/api/auth",
    tags=["registration"]
)

db_dependency = Annotated[Session, Depends(get_db)]
email_service_dependency = Annotated[BaseEmailService, Depends(get_email_service)]


@router.get("/registration-status", response_model=RegistrationStatusResponse)
def get_daily_registration_status(db: db_dependency):
    """Returns today's registration spots remaining (based on Brevo's 300 daily email quota in IST)."""
    return AuthService.get_registration_status(db)


@router.post("/send-otp")
def send_registration_otp(
    request: SendOTPRequest,
    db: db_dependency,
    email_service: email_service_dependency
):
    """
    Step 1: Enter college email to receive a 6-digit verification code.
    Checks Brevo quota, 30s cooldown, max 3 attempts per email in IST.
    Saves hashed OTP in database. Does NOT create a user yet.
    """
    return AuthService.request_registration_otp(
        request=request,
        db=db,
        email_service=email_service
    )


@router.post("/verify-otp", response_model=VerifyOTPResponse)
def verify_registration_otp(request: VerifyOTPRequest, db: db_dependency):
    """
    Step 2: Enter the 6-digit OTP code to verify college email ownership.
    Compares SHA-256 hash in database.
    Returns a 15-minute registration_token to proceed to password setup.
    """
    registration_token = AuthService.verify_registration_otp(
        email=request.email,
        otp_code=request.otp_code,
        db=db
    )

    return {
        "message": "Email verified successfully! Please set your password to complete account creation.",
        "registration_token": registration_token
    }


@router.post("/create-account", response_model=Token)
def create_student_account(request: CreateAccountRequest, db: db_dependency):
    """
    Step 3: Submit password and registration_token to create the user account.
    Returns Bearer access_token so user is immediately logged in.
    """
    user = AuthService.create_user_account(request=request, db=db)
    access_token = create_access_token(email=user.email, user_db_id=user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_onboarded": bool(user.is_onboarded)
    }


@router.get("/check-userid", response_model=CheckUserIdResponse)
def check_user_id_availability(
    user_id: Annotated[str, Query(min_length=3, max_length=30)],
    db: db_dependency
):
    """Live validation endpoint for the frontend: Checks if chosen user_id handle is free."""
    is_available = AuthService.is_user_id_available(user_id=user_id, db=db)
    return {
        "user_id": user_id,
        "is_available": is_available
    }


@router.post("/onboarding")
def complete_user_onboarding(
    request: OnboardingRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: db_dependency
):
    """
    Step 4: Student selects unique handle (user_id), campus, course, branch, and batch.
    Sets is_onboarded=True so user enters the main feed.
    """
    updated_user = AuthService.submit_onboarding(
        user=current_user,
        data=request,
        db=db
    )

    return {
        "message": "Onboarding completed successfully!",
        "user": {
            "id": updated_user.id,
            "email": updated_user.email,
            "user_id": updated_user.user_id,
            "full_name": updated_user.full_name,
            "student_id": updated_user.student_id,
            "college_name": updated_user.college_name,
            "campus": updated_user.campus,
            "course": updated_user.course,
            "branch": updated_user.branch,
            "batch": updated_user.batch,
            "avatar_url": updated_user.avatar_url,
            "bio": updated_user.bio,
            "is_onboarded": updated_user.is_onboarded
        }
    }
