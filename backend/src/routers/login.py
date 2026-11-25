from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated
from src.database.db import get_db
from sqlalchemy.orm import Session
from sqlalchemy import or_
from src.schemas.user import User
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from starlette import status
from datetime import timedelta, datetime, timezone
from jose import jwt, JWTError
from src.config import settings
from pydantic import BaseModel

router = APIRouter(
    prefix='/api/auth',
    tags=['auth']
)

class Token(BaseModel):
    access_token: str
    token_type: str
    is_onboarded: bool

class LoginUserRequest(BaseModel):
    user_name: str  # Can be email or user_id (unique handle)
    user_password: str

db_dependency = Annotated[Session, Depends(get_db)]
bcrypt_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth2_bearer = OAuth2PasswordBearer(tokenUrl='api/auth/login')

def authenticate_user(identifier: str, password: str, db: Session):
    # Allow logging in via either email or user_id
    user = db.query(User).filter(
        or_(User.email == identifier, User.user_id == identifier)
    ).first()

    if user is None:
        return False

    if not bcrypt_context.verify(password, user.hashed_password):
        return False

    return user

def create_access_token(email: str, user_db_id: int):
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    encode = {'sub': email, 'id': user_db_id, 'exp': expires}
    return jwt.encode(encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

async def get_current_user(token: Annotated[str, Depends(oauth2_bearer)], db: db_dependency):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get('sub')
        user_db_id: int = payload.get('id')

        if not email or not user_db_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

        user = db.query(User).filter(User.id == user_db_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

        return user

    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.get("/me")
def get_user_profile(user: Annotated[User, Depends(get_current_user)]):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "student_id": user.student_id,
        "college_name": user.college_name,
        "user_id": user.user_id,
        "campus": user.campus,
        "course": user.course,
        "branch": user.branch,
        "batch": user.batch,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "role": user.role,
        "is_onboarded": user.is_onboarded,
    }

@router.post("/login", response_model=Token)
def login_for_access_token(db: db_dependency, login_request: LoginUserRequest):
    user = authenticate_user(login_request.user_name, login_request.user_password, db)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid username/email or password')

    token = create_access_token(user.email, user.id)

    return {
        'access_token': token,
        'token_type': 'bearer',
        'is_onboarded': bool(user.is_onboarded)
    }
