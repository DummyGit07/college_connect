from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database.db import get_db
from src.routers.login import get_current_user
from src.schemas.post import (
    CommentListResponse,
    CommentResponse,
    CommentVoteResponse,
    CreateCommentRequest,
    CreatePostRequest,
    DeleteResponse,
    HideResponse,
    PostFeedResponse,
    PostResponse,
    PostVoteResponse,
    VoteRequest,
)
from src.schemas.user import User
from src.services import post_service

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
    limit: int = Query(default=20, ge=1, le=50),
    cursor: Optional[str] = None,
):
    posts, next_cursor, has_more = post_service.get_posts_feed(
        db=db,
        user=user,
        sort=sort,
        campus=campus,
        tag=tag,
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
    return post_service.create_post(
        db=db, user=user, content=payload.content, tags=payload.tags
    )


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
    return HideResponse(id=post.id, is_hidden=bool(post.is_hidden), hidden_by=post.hidden_by)


@router.delete("/posts/{post_id}", response_model=DeleteResponse)
def delete_post(
    post_id: int,
    db: db_dependency,
    user: onboarded_user_dependency,
):
    action = post_service.delete_post(db=db, user=user, post_id=post_id)
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
    return post_service.create_comment(
        db=db, user=user, post_id=post_id, content=payload.content
    )


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
    action = post_service.delete_comment(db=db, user=user, comment_id=comment_id)
    return DeleteResponse(id=comment_id, action=action)
