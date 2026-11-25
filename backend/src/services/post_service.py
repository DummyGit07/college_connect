from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from fastapi import HTTPException, status
from sqlalchemy import case
from sqlalchemy.orm import Session

from src.schemas.post import (
    ALLOWED_TAGS,
    Comment,
    CommentResponse,
    CommentVote,
    Post,
    PostResponse,
    PostTag,
    PostVote,
)
from src.schemas.user import User

RETENTION_DAYS = 7
CLEANUP_INTERVAL = timedelta(hours=1)
_last_cleanup_at: Optional[datetime] = None

SortOption = Literal["latest", "most_liked", "most_disliked", "trending"]


def _retention_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)


def cleanup_expired_posts(db: Session, force: bool = False) -> int:
    """Delete posts older than 7 days (throttled to once per hour unless forced)."""
    global _last_cleanup_at
    now = datetime.now(timezone.utc)
    if not force and _last_cleanup_at and (now - _last_cleanup_at) < CLEANUP_INTERVAL:
        return 0

    cutoff = _retention_cutoff()
    expired_ids = [
        row[0] for row in db.query(Post.id).filter(Post.created_at < cutoff).all()
    ]
    _last_cleanup_at = now

    if not expired_ids:
        return 0

    comment_ids = [
        row[0] for row in db.query(Comment.id).filter(Comment.post_id.in_(expired_ids)).all()
    ]
    if comment_ids:
        db.query(CommentVote).filter(CommentVote.comment_id.in_(comment_ids)).delete(
            synchronize_session=False
        )
        db.query(Comment).filter(Comment.id.in_(comment_ids)).delete(
            synchronize_session=False
        )

    db.query(PostVote).filter(PostVote.post_id.in_(expired_ids)).delete(
        synchronize_session=False
    )
    db.query(PostTag).filter(PostTag.post_id.in_(expired_ids)).delete(
        synchronize_session=False
    )
    deleted_count = (
        db.query(Post)
        .filter(Post.id.in_(expired_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted_count


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def _get_visible_post(db: Session, post_id: int, user: User) -> Post:
    cutoff = _retention_cutoff()
    post = (
        db.query(Post)
        .filter(Post.id == post_id, Post.created_at >= cutoff)
        .first()
    )
    if not post or (post.is_hidden and user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )
    return post


def _toggle_vote(
    db: Session,
    vote_model,
    fk_field: str,
    target_obj,
    user_id: int,
    vote_type: int,
) -> int:
    """Insert, toggle off, or switch a like/dislike vote and update cached counts."""
    existing = (
        db.query(vote_model)
        .filter(
            getattr(vote_model, fk_field) == target_obj.id,
            vote_model.user_id == user_id,
        )
        .first()
    )

    if existing:
        if existing.vote_type == vote_type:
            # Toggle off
            if vote_type == 1:
                target_obj.likes_count = max(0, target_obj.likes_count - 1)
            else:
                target_obj.dislikes_count = max(0, target_obj.dislikes_count - 1)
            db.delete(existing)
            new_vote = 0
        else:
            # Switch vote
            if vote_type == 1:
                target_obj.dislikes_count = max(0, target_obj.dislikes_count - 1)
                target_obj.likes_count += 1
            else:
                target_obj.likes_count = max(0, target_obj.likes_count - 1)
                target_obj.dislikes_count += 1
            existing.vote_type = vote_type
            new_vote = vote_type
    else:
        if vote_type == 1:
            target_obj.likes_count += 1
        else:
            target_obj.dislikes_count += 1
        db.add(vote_model(**{fk_field: target_obj.id, "user_id": user_id, "vote_type": vote_type}))
        new_vote = vote_type

    db.commit()
    db.refresh(target_obj)
    return new_vote


def _serialize_posts(
    db: Session, posts: list[Post], user: User
) -> list[PostResponse]:
    if not posts:
        return []

    post_ids = [p.id for p in posts]
    tag_rows = db.query(PostTag).filter(PostTag.post_id.in_(post_ids)).all()
    tags_by_post: dict[int, list[str]] = {pid: [] for pid in post_ids}
    for row in tag_rows:
        tags_by_post[row.post_id].append(row.tag)

    vote_rows = (
        db.query(PostVote)
        .filter(PostVote.post_id.in_(post_ids), PostVote.user_id == user.id)
        .all()
    )
    votes_by_post = {row.post_id: row.vote_type for row in vote_rows}

    is_admin = user.role == "admin"
    return [
        PostResponse(
            id=p.id,
            campus=p.campus,
            content=p.content,
            tags=tags_by_post.get(p.id, []),
            likes_count=p.likes_count,
            dislikes_count=p.dislikes_count,
            comments_count=p.comments_count,
            my_vote=votes_by_post.get(p.id, 0),
            is_own_post=(p.author_id == user.id),
            is_hidden=bool(p.is_hidden),
            hidden_by=p.hidden_by if is_admin else None,
            created_at=p.created_at,
        )
        for p in posts
    ]


def get_posts_feed(
    db: Session,
    user: User,
    sort: SortOption = "latest",
    campus: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 20,
    cursor: Optional[str] = None,
) -> tuple[list[PostResponse], Optional[str], bool]:
    cutoff = _retention_cutoff()
    query = db.query(Post).filter(Post.created_at >= cutoff)

    if user.role != "admin":
        query = query.filter(Post.is_hidden.is_(False))

    if campus and campus.strip().lower() != "all":
        query = query.filter(Post.campus == campus.strip())

    if tag:
        slug = tag.strip().lower()
        if slug == "general":
            tagged_ids = db.query(PostTag.post_id)
            query = query.filter(~Post.id.in_(tagged_ids))
        elif slug in ALLOWED_TAGS:
            matching_ids = db.query(PostTag.post_id).filter(PostTag.tag == slug)
            query = query.filter(Post.id.in_(matching_ids))
        else:
            return [], None, False

    if sort == "latest":
        if cursor:
            try:
                before_id = int(cursor)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor"
                )
            query = query.filter(Post.id < before_id)

        rows = query.order_by(Post.id.desc()).limit(limit + 1).all()
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = str(items[-1].id) if has_more and items else None
    else:
        offset = 0
        if cursor:
            try:
                offset = max(0, int(cursor))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor"
                )

        if sort == "most_liked":
            query = query.order_by(Post.likes_count.desc(), Post.id.desc())
        elif sort == "most_disliked":
            query = query.order_by(Post.dislikes_count.desc(), Post.id.desc())
        else:  # trending: max of likes_count or dislikes_count
            trending_score = case(
                (Post.likes_count >= Post.dislikes_count, Post.likes_count),
                else_=Post.dislikes_count,
            )
            query = query.order_by(trending_score.desc(), Post.id.desc())

        rows = query.offset(offset).limit(limit + 1).all()
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = str(offset + limit) if has_more else None

    return _serialize_posts(db, items, user), next_cursor, has_more


def create_post(
    db: Session, user: User, content: str, tags: list[str]
) -> PostResponse:
    cleanup_expired_posts(db)

    post = Post(
        author_id=user.id,
        campus=user.campus,
        content=content,
    )
    db.add(post)
    db.flush()

    for slug in tags:
        db.add(PostTag(post_id=post.id, tag=slug))

    db.commit()
    db.refresh(post)
    return _serialize_posts(db, [post], user)[0]


def vote_post(
    db: Session, user: User, post_id: int, vote_type: int
) -> tuple[Post, int]:
    post = _get_visible_post(db, post_id, user)
    new_vote = _toggle_vote(db, PostVote, "post_id", post, user.id, vote_type)
    return post, new_vote


def toggle_hide_post(db: Session, user: User, post_id: int) -> Post:
    _require_admin(user)
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )
    post.is_hidden = not bool(post.is_hidden)
    post.hidden_by = "admin" if post.is_hidden else None
    db.commit()
    db.refresh(post)
    return post


def delete_post(db: Session, user: User, post_id: int) -> Literal["hidden", "deleted"]:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    if user.role == "admin":
        comment_ids = [
            row[0]
            for row in db.query(Comment.id).filter(Comment.post_id == post.id).all()
        ]
        if comment_ids:
            db.query(CommentVote).filter(CommentVote.comment_id.in_(comment_ids)).delete(
                synchronize_session=False
            )
            db.query(Comment).filter(Comment.id.in_(comment_ids)).delete(
                synchronize_session=False
            )
        db.query(PostVote).filter(PostVote.post_id == post.id).delete(
            synchronize_session=False
        )
        db.query(PostTag).filter(PostTag.post_id == post.id).delete(
            synchronize_session=False
        )
        db.delete(post)
        db.commit()
        return "deleted"

    if post.author_id == user.id:
        post.is_hidden = True
        post.hidden_by = "author"
        db.commit()
        return "hidden"

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to delete this post",
    )


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


def _serialize_comments(
    db: Session, comments: list[Comment], user: User
) -> list[CommentResponse]:
    if not comments:
        return []

    comment_ids = [c.id for c in comments]
    vote_rows = (
        db.query(CommentVote)
        .filter(
            CommentVote.comment_id.in_(comment_ids),
            CommentVote.user_id == user.id,
        )
        .all()
    )
    votes_by_comment = {row.comment_id: row.vote_type for row in vote_rows}
    is_admin = user.role == "admin"

    return [
        CommentResponse(
            id=c.id,
            post_id=c.post_id,
            campus=c.campus,
            content=c.content,
            likes_count=c.likes_count,
            dislikes_count=c.dislikes_count,
            my_vote=votes_by_comment.get(c.id, 0),
            is_own_comment=(c.author_id == user.id),
            is_hidden=bool(c.is_hidden),
            hidden_by=c.hidden_by if is_admin else None,
            created_at=c.created_at,
        )
        for c in comments
    ]


def get_comments(
    db: Session,
    user: User,
    post_id: int,
    limit: int = 20,
    before_id: Optional[int] = None,
) -> tuple[list[CommentResponse], Optional[str], bool]:
    _get_visible_post(db, post_id, user)

    query = db.query(Comment).filter(Comment.post_id == post_id)
    if user.role != "admin":
        query = query.filter(Comment.is_hidden.is_(False))
    if before_id is not None:
        query = query.filter(Comment.id < before_id)

    rows = query.order_by(Comment.id.desc()).limit(limit + 1).all()
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = str(items[-1].id) if has_more and items else None
    return _serialize_comments(db, items, user), next_cursor, has_more


def create_comment(
    db: Session, user: User, post_id: int, content: str
) -> CommentResponse:
    post = _get_visible_post(db, post_id, user)
    comment = Comment(
        post_id=post.id,
        author_id=user.id,
        campus=user.campus,
        content=content,
    )
    db.add(comment)
    post.comments_count += 1
    db.commit()
    db.refresh(comment)
    return _serialize_comments(db, [comment], user)[0]


def vote_comment(
    db: Session, user: User, comment_id: int, vote_type: int
) -> tuple[Comment, int]:
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment or (comment.is_hidden and user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )
    _get_visible_post(db, comment.post_id, user)
    new_vote = _toggle_vote(
        db, CommentVote, "comment_id", comment, user.id, vote_type
    )
    return comment, new_vote


def toggle_hide_comment(db: Session, user: User, comment_id: int) -> Comment:
    _require_admin(user)
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )
    post = db.query(Post).filter(Post.id == comment.post_id).first()

    was_hidden = bool(comment.is_hidden)
    comment.is_hidden = not was_hidden
    comment.hidden_by = "admin" if comment.is_hidden else None

    if post:
        if comment.is_hidden and not was_hidden:
            post.comments_count = max(0, post.comments_count - 1)
        elif not comment.is_hidden and was_hidden:
            post.comments_count += 1

    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(
    db: Session, user: User, comment_id: int
) -> Literal["hidden", "deleted"]:
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )
    post = db.query(Post).filter(Post.id == comment.post_id).first()

    if user.role == "admin":
        if post and not comment.is_hidden:
            post.comments_count = max(0, post.comments_count - 1)
        db.query(CommentVote).filter(CommentVote.comment_id == comment.id).delete(
            synchronize_session=False
        )
        db.delete(comment)
        db.commit()
        return "deleted"

    if comment.author_id == user.id:
        if not comment.is_hidden:
            comment.is_hidden = True
            comment.hidden_by = "author"
            if post:
                post.comments_count = max(0, post.comments_count - 1)
            db.commit()
        return "hidden"

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to delete this comment",
    )
