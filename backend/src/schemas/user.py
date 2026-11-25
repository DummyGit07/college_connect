from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from src.database.db import Base

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)

    # Registration fields (extracted from college email or entered)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    student_id = Column(String, index=True, nullable=True) # e.g. "21BCS101"
    college_name = Column(String, nullable=True)           # e.g. "collegename.ac.in"
    full_name = Column(String, nullable=True)              # Extracted from email or entered

    # Onboarding fields (filled when user completes onboarding form)
    user_id = Column(String, unique=True, index=True, nullable=True) # Unique handle/tag (e.g. "neeraj_07")
    campus = Column(String, index=True, nullable=True)               # e.g. "Campus 1", "Campus 2", "Campus 3"
    course = Column(String, nullable=True)                           # e.g. "B.Tech"
    branch = Column(String, nullable=True)                           # e.g. "CSE"
    batch = Column(String, nullable=True)                            # e.g. "2022-2026"
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)

    # Status & Flags
    role = Column(String, default="student")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_onboarded = Column(Boolean, default=False)                    # Set to True when onboarding form is submitted

    created_at = Column(DateTime(timezone=True), default=func.now())
