from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.database.db import Base
from src.routers import posts as posts_router
from src.schemas.post import (
    CreateCommentRequest,
    CreatePostRequest,
    Post,
    VoteRequest,
)
from src.schemas.user import User
from src.services import post_service

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

    student1 = User(
        email="s1.101@gehu.ac.in",
        hashed_password="x",
        user_id="s1_user",
        campus="Bhimtal",
        role="student",
        is_active=True,
        is_verified=True,
        is_onboarded=True,
    )
    student2 = User(
        email="s2.102@geu.ac.in",
        hashed_password="x",
        user_id="s2_user",
        campus="Dehradun",
        role="student",
        is_active=True,
        is_verified=True,
        is_onboarded=True,
    )
    unonboarded = User(
        email="s3.103@gehu.ac.in",
        hashed_password="x",
        role="student",
        is_active=True,
        is_verified=True,
        is_onboarded=False,
    )
    admin = User(
        email="admin.1@gehu.ac.in",
        hashed_password="x",
        user_id="admin_user",
        campus="Haldwani",
        role="admin",
        is_active=True,
        is_verified=True,
        is_onboarded=True,
    )
    db.add_all([student1, student2, unonboarded, admin])
    db.commit()
    for u in (student1, student2, unonboarded, admin):
        db.refresh(u)

    # 1. Onboarding gate
    assert_raises_http(403, posts_router.require_onboarded_user, unonboarded)

    # 2. Create 25 posts to test 20 + 10 pagination, tags, and anonymity
    created_ids = []
    for i in range(25):
        tags = ["crush", "hangout"] if i % 2 == 0 else []
        payload = CreatePostRequest(content=f"Post #{i}", tags=tags)
        data = posts_router.create_post(db=db, user=student1, payload=payload)
        assert not hasattr(data, "author_id")
        assert data.campus == "Bhimtal"
        assert data.is_own_post is True
        created_ids.append(data.id)

    # Reject >3 tags or invalid tag
    try:
        CreatePostRequest(content="too many", tags=["crush", "hangout", "hackathon", "events"])
        raise AssertionError("Expected ValidationError for >3 tags")
    except ValidationError:
        pass

    # 3. Feed pagination: 20 first, then 10 (returns remaining 5)
    page1 = posts_router.list_posts(db=db, user=student2, limit=20)
    assert len(page1.posts) == 20
    assert page1.has_more is True
    assert page1.posts[0].is_own_post is False

    page2 = posts_router.list_posts(db=db, user=student2, limit=10, cursor=page1.next_cursor)
    assert len(page2.posts) == 5
    assert page2.has_more is False
    ids_p1 = {p.id for p in page1.posts}
    ids_p2 = {p.id for p in page2.posts}
    assert ids_p1.isdisjoint(ids_p2)

    # 4. Voting (like, switch to dislike, toggle off) & sorting
    p_like = created_ids[0]
    p_dislike = created_ids[1]
    assert posts_router.vote_post(p_like, db, student1, VoteRequest(vote_type=1)).likes_count == 1
    assert posts_router.vote_post(p_like, db, student2, VoteRequest(vote_type=1)).likes_count == 2
    sw = posts_router.vote_post(p_like, db, student2, VoteRequest(vote_type=-1))
    assert sw.likes_count == 1 and sw.dislikes_count == 1 and sw.my_vote == -1
    off = posts_router.vote_post(p_like, db, student2, VoteRequest(vote_type=-1))
    assert off.dislikes_count == 0 and off.my_vote == 0

    posts_router.vote_post(p_dislike, db, student1, VoteRequest(vote_type=-1))
    posts_router.vote_post(p_dislike, db, student2, VoteRequest(vote_type=-1))

    most_liked = posts_router.list_posts(db=db, user=student2, sort="most_liked", limit=5).posts
    assert most_liked[0].id == p_like
    most_disliked = posts_router.list_posts(db=db, user=student2, sort="most_disliked", limit=5).posts
    assert most_disliked[0].id == p_dislike
    trending = posts_router.list_posts(db=db, user=student2, sort="trending", limit=5).posts
    assert trending[0].id == p_dislike  # 0+2+0=2 > 1+0+0=1

    # Tag & campus filters
    crush_posts = posts_router.list_posts(db=db, user=student2, tag="crush", limit=30).posts
    assert all("crush" in p.tags for p in crush_posts)
    general_posts = posts_router.list_posts(db=db, user=student2, tag="general", limit=30).posts
    assert all(p.tags == [] for p in general_posts)
    assert len(posts_router.list_posts(db=db, user=student2, campus="Dehradun", limit=20).posts) == 0

    # 5. Comments: create, vote, author soft-hide, admin visibility
    c_res = posts_router.create_comment(
        p_like, db, student2, CreateCommentRequest(content="First comment")
    )
    assert c_res.campus == "Dehradun"
    assert posts_router.vote_comment(c_res.id, db, student1, VoteRequest(vote_type=1)).likes_count == 1

    del_c = posts_router.delete_comment(c_res.id, db, student2)
    assert del_c.action == "hidden"
    assert len(posts_router.list_comments(p_like, db, student1, limit=20, before_id=None).comments) == 0
    admin_comments = posts_router.list_comments(p_like, db, admin, limit=20, before_id=None).comments
    assert len(admin_comments) == 1 and admin_comments[0].is_hidden is True

    # 6. Author soft-hides own post; student cannot hide/delete others' post; admin hides & hard-deletes
    assert_raises_http(403, posts_router.toggle_hide_post, p_like, db, student1)
    assert_raises_http(403, posts_router.delete_post, p_like, db, student2)

    own_del = posts_router.delete_post(p_like, db, student1)
    assert own_del.action == "hidden"
    assert all(p.id != p_like for p in posts_router.list_posts(db=db, user=student2, limit=30).posts)
    admin_feed = posts_router.list_posts(db=db, user=admin, limit=30).posts
    hidden_item = next(p for p in admin_feed if p.id == p_like)
    assert hidden_item.is_hidden is True and hidden_item.hidden_by == "author"

    # Admin-only hidden_only filter
    assert_raises_http(403, posts_router.list_posts, db=db, user=student2, hidden_only=True, limit=30)
    hidden_only_feed = posts_router.list_posts(db=db, user=admin, hidden_only=True, limit=30).posts
    assert len(hidden_only_feed) == 1 and hidden_only_feed[0].id == p_like and hidden_only_feed[0].is_hidden is True

    # Admin hard-deletes post
    assert posts_router.delete_post(p_like, db, admin).action == "deleted"
    assert all(p.id != p_like for p in posts_router.list_posts(db=db, user=admin, limit=30).posts)

    # 7. 7-day retention cleanup
    old_post = Post(
        author_id=student1.id,
        campus="Bhimtal",
        content="Expired post",
        created_at=datetime.now(timezone.utc) - timedelta(days=8),
    )
    db.add(old_post)
    db.commit()
    db.refresh(old_post)
    assert all(p.id != old_post.id for p in posts_router.list_posts(db=db, user=admin, limit=50).posts)
    assert post_service.cleanup_expired_posts(db, force=True) == 1

    db.close()
    print("ALL POSTS & COMMENTS API TESTS PASSED!")


if __name__ == "__main__":
    run_tests()
