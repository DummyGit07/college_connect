from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class RegistrationStatusResponse(BaseModel):
    is_registration_open: bool
    daily_limit: int
    emails_sent_today: int
    remaining_spots: int

class SendOTPRequest(BaseModel):
    """Step 1: Student submits only their college email to request a verification OTP."""
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    """Step 2: Student submits the 6-digit OTP code received."""
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

class VerifyOTPResponse(BaseModel):
    """Step 2 Response: Returns a 15-minute registration proof token."""
    message: str
    registration_token: str

class CreateAccountRequest(BaseModel):
    """Step 3: Student sets their password, submitting the registration token."""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    registration_token: str = Field(..., description="Proof of verified email from Step 2")

class CheckUserIdResponse(BaseModel):
    user_id: str
    is_available: bool

class OnboardingRequest(BaseModel):
    """Step 4: Student completes their profile handle and academic details."""
    user_id: str = Field(..., min_length=3, max_length=30, description="Unique public social handle (e.g. neeraj_07)")
    campus: str = Field(..., description="Campus chosen by the student")
    course: Optional[str] = Field(None, description="e.g. B.Tech, BCA, MBA")
    branch: Optional[str] = Field(None, description="e.g. Computer Science, Mechanical")
    batch: Optional[str] = Field(None, description="e.g. 2022-2026")
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=160)
