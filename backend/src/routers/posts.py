from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database.db import get_db
from src.routers.login import get_current_user
from src.schemas.post import (
    Comment,
    CommentListResponse,
    CommentResponse,
    CommentVoteResponse,
    CreateCommentRequest,
    CreatePostRequest,
    DeleteResponse,
    HideResponse,
    Post,
    PostFeedResponse,
    PostResponse,
    PostVoteResponse,
    VoteRequest,
)
from src.schemas.user import User
from src.services import post_service
from src.services.ws_manager import ws_manager

router = APIRouter(prefix="/api", tags=["posts"])

db_dependency = Annotated[Session, Depends(get_db)]


def require_onboarded_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not user.is_onboarded:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please complete onboarding before accessing posts",
        )
    return user


onboarded_user_dependency = Annotated[User, Depends(require_onboarded_user)]


@router.get("/posts", response_model=PostFeedResponse)
def list_posts(
    db: db_dependency,
    user: onboarded_user_dependency,
    sort: post_service.SortOption = "latest",
    campus: Optional[str] = None,
    tag: Optional[str] = None,
    hidden_only: Annotated[bool, Query()] = False,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: Optional[str] = None,
):
    if hidden_only and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    posts, next_cursor, has_more = post_service.get_posts_feed(
        db=db,
        user=user,
        sort=sort,
        campus=campus,
        tag=tag,
        hidden_only=hidden_only,
        limit=limit,
        cursor=cursor,
    )
    return PostFeedResponse(posts=posts, next_cursor=next_cursor, has_more=has_more)


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    db: db_dependency,
    user: onboarded_user_dependency,
    payload: CreatePostRequest,
):
    post = post_service.create_post(
        db=db, user=user, content=payload.content, tags=payload.tags
    )
    ws_manager.broadcast_json_sync(
        {
            "type": "new_post",
            "post": post.model_dump(mode="json", exclude={"my_vote", "is_own_post"}),
        }
    )
    return post


@router.post("/posts/{post_id}/vote", response_model=PostVoteResponse)
def vote_post(
    post_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
    payload: VoteRequest,
):
    post, my_vote = post_service.vote_post(
        db=db, user=user, post_id=post_id, vote_type=payload.vote_type
    )
    ws_manager.broadcast_json_sync(
        {
            "type": "post_voted",
            "post_id": post.id,
            "likes_count": post.likes_count,
            "dislikes_count": post.dislikes_count,
        }
    )
    return PostVoteResponse(
        post_id=post.id,
        likes_count=post.likes_count,
        dislikes_count=post.dislikes_count,
        my_vote=my_vote,
    )


@router.patch("/posts/{post_id}/hide", response_model=HideResponse)
def toggle_hide_post(
    post_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
):
    post = post_service.toggle_hide_post(db=db, user=user, post_id=post_id)
    ws_manager.broadcast_json_sync(
        {
            "type": "post_hidden",
            "post_id": post.id,
            "is_hidden": bool(post.is_hidden),
            "hidden_by": post.hidden_by,
        }
    )
    return HideResponse(id=post.id, is_hidden=bool(post.is_hidden), hidden_by=post.hidden_by)


@router.delete("/posts/{post_id}", response_model=DeleteResponse)
def delete_post(
    post_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
):
    action = post_service.delete_post(db=db, user=user, post_id=post_id)
    ws_manager.broadcast_json_sync(
        {
            "type": "post_deleted",
            "post_id": post_id,
            "action": action,
        }
    )
    return DeleteResponse(id=post_id, action=action)


@router.get("/posts/{post_id}/comments", response_model=CommentListResponse)
def list_comments(
    post_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
    limit: int = Query(default=20, ge=1, le=50),
    before_id: Optional[int] = Query(default=None, ge=1),
):
    comments, next_cursor, has_more = post_service.get_comments(
        db=db, user=user, post_id=post_id, limit=limit, before_id=before_id
    )
    return CommentListResponse(
        comments=comments, next_cursor=next_cursor, has_more=has_more
    )


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
    payload: CreateCommentRequest,
):
    comment = post_service.create_comment(
        db=db, user=user, post_id=post_id, content=payload.content
    )
    comments_count = (
        db.query(Post.comments_count).filter(Post.id == post_id).scalar() or 0
    )
    ws_manager.broadcast_json_sync(
        {
            "type": "new_comment",
            "post_id": post_id,
            "comments_count": comments_count,
            "comment": comment.model_dump(
                mode="json", exclude={"my_vote", "is_own_comment"}
            ),
        }
    )
    return comment


@router.post("/comments/{comment_id}/vote", response_model=CommentVoteResponse)
def vote_comment(
    comment_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
    payload: VoteRequest,
):
    comment, my_vote = post_service.vote_comment(
        db=db, user=user, comment_id=comment_id, vote_type=payload.vote_type
    )
    ws_manager.broadcast_json_sync(
        {
            "type": "comment_voted",
            "post_id": comment.post_id,
            "comment_id": comment.id,
            "likes_count": comment.likes_count,
            "dislikes_count": comment.dislikes_count,
        }
    )
    return CommentVoteResponse(
        comment_id=comment.id,
        likes_count=comment.likes_count,
        dislikes_count=comment.dislikes_count,
        my_vote=my_vote,
    )


@router.patch("/comments/{comment_id}/hide", response_model=HideResponse)
def toggle_hide_comment(
    comment_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
):
    comment = post_service.toggle_hide_comment(
        db=db, user=user, comment_id=comment_id
    )
    ws_manager.broadcast_json_sync(
        {
            "type": "comment_hidden",
            "post_id": comment.post_id,
            "comment_id": comment.id,
            "is_hidden": bool(comment.is_hidden),
            "hidden_by": comment.hidden_by,
        }
    )
    return HideResponse(
        id=comment.id,
        is_hidden=bool(comment.is_hidden),
        hidden_by=comment.hidden_by,
    )


@router.delete("/comments/{comment_id}", response_model=DeleteResponse)
def delete_comment(
    comment_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
):
    comment_post_id = (
        db.query(Comment.post_id).filter(Comment.id == comment_id).scalar()
    )
    action = post_service.delete_comment(db=db, user=user, comment_id=comment_id)
    if comment_post_id is not None:
        comments_count = (
            db.query(Post.comments_count)
            .filter(Post.id == comment_post_id)
            .scalar()
            or 0
        )
        ws_manager.broadcast_json_sync(
            {
                "type": "comment_deleted",
                "post_id": comment_post_id,
                "comment_id": comment_id,
                "action": action,
                "comments_count": comments_count,
            }
        )
    return DeleteResponse(id=comment_id, action=action)
