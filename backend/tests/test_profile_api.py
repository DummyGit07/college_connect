from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.database.db import Base
from src.routers import login as login_router
from src.routers import profile as profile_router
from src.schemas.user import User

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def assert_raises_http(status_code: int, fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
        raise AssertionError(f"Expected HTTPException({status_code}), got no error")
    except HTTPException as exc:
        assert exc.status_code == status_code, f"Expected {status_code}, got {exc.status_code}: {exc.detail}"


def run_tests():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    student = User(
        email="s1@gehu.ac.in",
        hashed_password=login_router.bcrypt_context.hash("OldPass123"),
        student_id="21BCS101",
        college_name="gehu.ac.in",
        full_name="Rahul Sharma",
        user_id="rahul_01",
        campus="Bhimtal",
        course="B.Tech",
        branch="CSE",
        batch="2022-2026",
        bio="Hello",
        role="student",
        is_active=True,
        is_verified=True,
        is_onboarded=True,
    )
    admin = User(
        email="admin@gehu.ac.in",
        hashed_password=login_router.bcrypt_context.hash("AdminPass123"),
        student_id="21BCS001",
        college_name="gehu.ac.in",
        full_name="Admin User",
        user_id="admin_01",
        campus="Haldwani",
        role="admin",
        is_active=True,
        is_verified=True,
        is_onboarded=True,
    )
    db.add_all([student, admin])
    db.commit()
    db.refresh(student)
    db.refresh(admin)

    # 1. Safe profile omits PII & non-profile metadata, keeps role
    safe = profile_router.get_safe_profile(student).model_dump()
    assert safe["user_id"] == "rahul_01"
    assert safe["role"] == "student"
    for hidden_key in ("email", "full_name", "student_id", "college_name", "created_at", "hashed_password"):
        assert hidden_key not in safe

    # 2. Update profile updates editable fields and keeps user_id locked
    updated = profile_router.update_safe_profile(
        profile_router.ProfileUpdateRequest(campus="Dehradun", bio="Updated bio"),
        db=db,
        user=student,
    )
    assert updated.campus == "Dehradun"
    assert updated.bio == "Updated bio"
    assert updated.user_id == "rahul_01"

    # 3. Change password rejects wrong current password, succeeds on valid
    assert_raises_http(
        400,
        profile_router.change_password,
        profile_router.ChangePasswordRequest(current_password="Wrong", new_password="NewPass123"),
        db=db,
        user=student,
    )
    res = profile_router.change_password(
        profile_router.ChangePasswordRequest(current_password="OldPass123", new_password="NewPass123"),
        db=db,
        user=student,
    )
    assert res["message"] == "Password updated successfully."
    assert login_router.bcrypt_context.verify("NewPass123", student.hashed_password)

    # 4. Admin users list: student forbidden, admin sees users and can filter
    assert_raises_http(
        403,
        profile_router.list_users_for_admin,
        db=db,
        user=student,
    )
    users_res = profile_router.list_users_for_admin(
        db=db,
        user=admin,
        search="rahul",
        status_filter="all",
        limit=20,
        offset=0,
    )
    assert users_res.total == 1
    assert users_res.users[0].student_id == "21BCS101"

    # 5. Suspend/unsuspend + self-protection + login notification
    assert_raises_http(
        400,
        profile_router.set_user_active_status,
        admin.id,
        profile_router.SuspendUserRequest(is_active=False),
        db=db,
        user=admin,
    )
    susp = profile_router.set_user_active_status(
        student.id,
        profile_router.SuspendUserRequest(is_active=False),
        db=db,
        user=admin,
    )
    assert susp.is_active is False

    # Suspended user gets 403 on login
    assert_raises_http(
        403,
        login_router.login_for_access_token,
        db=db,
        login_request=login_router.LoginUserRequest(user_name="rahul_01", user_password="NewPass123"),
    )

    # Unblock restores login
    unsusp = profile_router.set_user_active_status(
        student.id,
        profile_router.SuspendUserRequest(is_active=True),
        db=db,
        user=admin,
    )
    assert unsusp.is_active is True
    tok = login_router.login_for_access_token(
        db=db,
        login_request=login_router.LoginUserRequest(user_name="rahul_01", user_password="NewPass123"),
    )
    assert tok["access_token"]

    print("All profile & suspension tests passed!")


if __name__ == "__main__":
    run_tests()
