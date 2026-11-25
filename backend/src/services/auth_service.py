import secrets
import hashlib
from datetime import datetime, timezone, timedelta, time
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from passlib.context import CryptContext
from jose import jwt, JWTError

from src.config import settings
from src.schemas.user import User
from src.schemas.otp import EmailOTP
from src.schemas.auth import SendOTPRequest, CreateAccountRequest, OnboardingRequest
from src.services.email_service import BaseEmailService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
IST = timezone(timedelta(hours=5, minutes=30))  # Indian Standard Time (UTC+05:30)


class AuthService:
    """Enterprise OOP service encapsulating user registration and onboarding business logic."""

    @staticmethod
    def now_ist() -> datetime:
        """Return current time in Indian Standard Time (IST)."""
        return datetime.now(IST)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def hash_otp(otp_code: str) -> str:
        """Cryptographic SHA-256 hash of the OTP code so the database never stores raw OTPs."""
        return hashlib.sha256(otp_code.strip().encode("utf-8")).hexdigest()

    @classmethod
    def create_registration_token(cls, email: str) -> str:
        """Issue a short-lived (15 minutes) signed token proving email verification."""
        expires = cls.now_ist() + timedelta(minutes=15)
        payload = {
            "sub": email,
            "type": "registration_token",
            "exp": expires
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @classmethod
    def verify_registration_token(cls, token: str, expected_email: str) -> bool:
        """Verify the registration token to ensure Step 3 cannot be called without Step 2."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            token_email = payload.get("sub")
            token_type = payload.get("type")

            if token_type != "registration_token" or token_email != expected_email.strip().lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or mismatched registration token. Please verify OTP again."
                )
            return True
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration token has expired or is invalid. Please verify OTP again."
            )

    @classmethod
    def clean_expired_otps(cls, db: Session) -> None:
        """Purge OTP records older than 2 days to keep the database lightweight."""
        cutoff = cls.now_ist() - timedelta(days=2)
        db.query(EmailOTP).filter(EmailOTP.created_at < cutoff).delete()
        db.commit()

    @classmethod
    def get_today_ist_start(cls) -> datetime:
        """Return midnight timestamp of the current day in IST (resets at 00:00 AM India time)."""
        return datetime.combine(cls.now_ist().date(), time.min, tzinfo=IST)

    @classmethod
    def get_registration_status(cls, db: Session) -> dict:
        """Return today's email quota and remaining capacity for the registration UI in IST."""
        today_start = cls.get_today_ist_start()
        emails_sent_today = db.query(EmailOTP).filter(EmailOTP.created_at >= today_start).count()
        remaining_spots = max(0, settings.DAILY_EMAIL_LIMIT - emails_sent_today)

        return {
            "is_registration_open": remaining_spots > 0,
            "daily_limit": settings.DAILY_EMAIL_LIMIT,
            "emails_sent_today": emails_sent_today,
            "remaining_spots": remaining_spots,
        }

    @staticmethod
    def parse_college_email(email: str) -> Tuple[Optional[str], Optional[str], str]:
        """
        Extract full_name, student_id, and college domain from student email.
        Example: rohit.21bcs101@collegename.ac.in
        Returns: (full_name='Rohit', student_id='21BCS101', college_name='collegename')
        """
        email_clean = email.strip().lower()
        if "@" not in email_clean:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format")

        prefix, domain = email_clean.split("@", 1)

        parts = prefix.split(".")
        if len(parts) >= 2:
            full_name = " ".join(parts[:-1]).title()
            student_id = parts[-1].upper()
        else:
            full_name = prefix.title()
            student_id = None

        college_name = domain.split(".")[0].upper()

        if college_name not in ['GEHU', 'GEU']:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email domain. Please use your official college email.")

        return full_name, student_id, college_name

    @classmethod
    def request_registration_otp(
        cls,
        request: SendOTPRequest,
        db: Session,
        email_service: BaseEmailService
    ) -> dict:
        """
        Step 1: Validate email, check 3-tier rate limits, hash OTP with SHA-256, and send.
        NOTE: No user is created in the database at this step.
        """
        # 1. Clean up stale OTP records older than 2 days
        cls.clean_expired_otps(db)

        email = request.email.strip().lower()

        # 2. Check if an account already exists with this email
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this college email already exists. Please Sign in instead."
            )

        # 3. Check Global Daily Quota in IST (Brevo 300 Limit)
        today_start = cls.get_today_ist_start()
        total_sent_today = db.query(EmailOTP).filter(EmailOTP.created_at >= today_start).count()
        if total_sent_today >= settings.DAILY_EMAIL_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily registration quota ({settings.DAILY_EMAIL_LIMIT} students) has been reached. Please try again tomorrow!"
            )

        # 4. Check 30-Second Cooldown (Prevents rapid spam clicking)
        last_otp = db.query(EmailOTP).filter(
            EmailOTP.email == email
        ).order_by(EmailOTP.created_at.desc()).first()

        now = cls.now_ist()
        if last_otp and last_otp.created_at:
            last_created = last_otp.created_at if last_otp.created_at.tzinfo else last_otp.created_at.replace(tzinfo=IST)
            elapsed_seconds = (now - last_created).total_seconds()
            if elapsed_seconds < settings.OTP_COOLDOWN_SECONDS:
                remaining_wait = int(settings.OTP_COOLDOWN_SECONDS - elapsed_seconds)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {remaining_wait} seconds before requesting another verification code."
                )

        # 5. Check Per-Email Daily Limit (Max 3 attempts per day in IST)
        user_attempts_today = db.query(EmailOTP).filter(
            EmailOTP.email == email,
            EmailOTP.created_at >= today_start
        ).count()

        if user_attempts_today >= settings.MAX_OTP_ATTEMPTS_PER_EMAIL:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"You have reached the maximum of {settings.MAX_OTP_ATTEMPTS_PER_EMAIL} OTP attempts for this email today. Please try again tomorrow."
            )

        # 6. Generate 6-Digit Cryptographic OTP
        raw_otp_code = str(secrets.randbelow(900000) + 100000)
        hashed_otp_code = cls.hash_otp(raw_otp_code)
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        # Invalidate any previously pending unused OTPs for this email
        db.query(EmailOTP).filter(
            EmailOTP.email == email,
            EmailOTP.is_used == False
        ).update({"is_used": True})

        otp_record = EmailOTP(
            email=email,
            otp_code=hashed_otp_code,
            expires_at=expires_at,
            created_at=now,
            is_used=False
        )
        db.add(otp_record)
        db.commit()

        # 7. Send plaintext OTP via configured provider (Console in dev, Brevo in prod)
        sent_success = email_service.send_otp(to_email=email, otp=raw_otp_code)
        if not sent_success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to deliver verification code. Please check email service configuration."
            )

        return {
            "message": "Verification code sent successfully",
            "email": email,
            "expires_in_minutes": settings.OTP_EXPIRE_MINUTES
        }

    @classmethod
    def verify_registration_otp(cls, email: str, otp_code: str, db: Session) -> str:
        """
        Step 2: Verify submitted OTP against the SHA-256 hash in database.
        Returns a signed 15-minute registration_token to proceed to Step 3.
        """
        email_clean = email.strip().lower()
        now = cls.now_ist()
        hashed_input_otp = cls.hash_otp(otp_code)

        # Match compound (email + hashed_otp) where not used
        otp_record = db.query(EmailOTP).filter(
            EmailOTP.email == email_clean,
            EmailOTP.otp_code == hashed_input_otp,
            EmailOTP.is_used == False
        ).order_by(EmailOTP.created_at.desc()).first()

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code. Please check the code and try again."
            )

        record_expires = otp_record.expires_at if otp_record.expires_at.tzinfo else otp_record.expires_at.replace(tzinfo=IST)
        if record_expires < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new code."
            )

        # Mark OTP as used
        otp_record.is_used = True
        db.commit()

        # Issue 15-minute registration token
        return cls.create_registration_token(email=email_clean)

    @classmethod
    def create_user_account(cls, request: CreateAccountRequest, db: Session) -> User:
        """
        Step 3: Verify registration token, hash password, and create the user in database.
        """
        email_clean = request.email.strip().lower()

        # 1. Validate registration token
        cls.verify_registration_token(token=request.registration_token, expected_email=email_clean)

        # 2. Guard against race condition: check if user already exists
        existing_user = db.query(User).filter(User.email == email_clean).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email has already been created. Please log in."
            )

        # 3. Extract student profile from email
        full_name, student_id, college_name = cls.parse_college_email(email_clean)
        hashed_password = cls.get_password_hash(request.password)

        # 4. Create verified user account
        new_user = User(
            email=email_clean,
            hashed_password=hashed_password,
            full_name=full_name,
            student_id=student_id,
            college_name=college_name,
            is_verified=True,
            is_onboarded=False,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user

    @staticmethod
    def is_user_id_available(user_id: str, db: Session) -> bool:
        """Check if a social handle / user_id is available."""
        handle = user_id.strip().lower()
        user = db.query(User).filter(User.user_id == handle).first()
        return user is None

    @classmethod
    def submit_onboarding(cls, user: User, data: OnboardingRequest, db: Session) -> User:
        """Complete student profile onboarding."""
        chosen_handle = data.user_id.strip().lower()

        # Check if handle is taken by another user
        existing_handle_user = db.query(User).filter(
            User.user_id == chosen_handle,
            User.id != user.id
        ).first()

        if existing_handle_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The handle '{chosen_handle}' is already taken. Please choose another."
            )

        user.user_id = chosen_handle
        user.campus = data.campus.strip()
        user.course = data.course.strip() if data.course else None
        user.branch = data.branch.strip() if data.branch else None
        user.batch = data.batch.strip() if data.batch else None
        user.avatar_url = data.avatar_url.strip() if data.avatar_url else None
        user.bio = data.bio.strip() if data.bio else None
        user.is_onboarded = True

        db.commit()
        db.refresh(user)
        return user
