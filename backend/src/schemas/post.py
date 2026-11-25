from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from src.database.db import Base


ALLOWED_TAGS = (
    "confession",
    "crush",
    "class",
    "hackathon",
    "hangout",
    "lost-found",
    "events",
)


# ---------------------------------------------------------------------------
# SQLAlchemy ORM Models
# ---------------------------------------------------------------------------


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campus = Column(String, nullable=True, index=True)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0, nullable=False)
    dislikes_count = Column(Integer, default=0, nullable=False)
    comments_count = Column(Integer, default=0, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False, index=True)
    hidden_by = Column(String(16), nullable=True)  # None, "author", or "admin"
    created_at = Column(
        DateTime(timezone=True), default=func.now(), server_default=func.now(), index=True
    )


class PostTag(Base):
    __tablename__ = "post_tags"
    __table_args__ = (UniqueConstraint("post_id", "tag", name="uq_post_tag"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag = Column(String(32), nullable=False, index=True)


class PostVote(Base):
    __tablename__ = "post_votes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_user_vote"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type = Column(SmallInteger, nullable=False)  # 1 = like, -1 = dislike
    created_at = Column(
        DateTime(timezone=True), default=func.now(), server_default=func.now()
    )


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campus = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0, nullable=False)
    dislikes_count = Column(Integer, default=0, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False, index=True)
    hidden_by = Column(String(16), nullable=True)  # None, "author", or "admin"
    created_at = Column(
        DateTime(timezone=True), default=func.now(), server_default=func.now(), index=True
    )


class CommentVote(Base):
    __tablename__ = "comment_votes"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_user_vote"),
    )

    id = Column(Integer, primary_key=True)
    comment_id = Column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type = Column(SmallInteger, nullable=False)  # 1 = like, -1 = dislike
    created_at = Column(
        DateTime(timezone=True), default=func.now(), server_default=func.now()
    )


# ---------------------------------------------------------------------------
# Pydantic Request / Response Schemas
# ---------------------------------------------------------------------------


class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    tags: list[str] = Field(default_factory=list)

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Post content cannot be empty")
        if len(cleaned) > 10000:
            raise ValueError("Post content cannot exceed 10,000 characters")
        return cleaned

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in v:
            slug = raw.strip().lower()
            if not slug or slug == "general":
                continue
            if slug not in ALLOWED_TAGS:
                raise ValueError(
                    f"Invalid tag '{raw}'. Allowed tags: {', '.join(ALLOWED_TAGS)}"
                )
            if slug not in seen:
                seen.add(slug)
                normalized.append(slug)
        if len(normalized) > 3:
            raise ValueError("You can select at most 3 tags per post")
        return normalized


class PostResponse(BaseModel):
    id: int
    campus: Optional[str] = None
    content: str
    tags: list[str]
    likes_count: int
    dislikes_count: int
    comments_count: int
    my_vote: int  # 1, -1, or 0
    is_own_post: bool
    is_hidden: bool
    hidden_by: Optional[str] = None
    created_at: datetime


class PostFeedResponse(BaseModel):
    posts: list[PostResponse]
    next_cursor: Optional[str] = None
    has_more: bool


class VoteRequest(BaseModel):
    vote_type: Literal[1, -1]


class PostVoteResponse(BaseModel):
    post_id: int
    likes_count: int
    dislikes_count: int
    my_vote: int


class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Comment content cannot be empty")
        if len(cleaned) > 2000:
            raise ValueError("Comment cannot exceed 2,000 characters")
        return cleaned


class CommentResponse(BaseModel):
    id: int
    post_id: int
    campus: Optional[str] = None
    content: str
    likes_count: int
    dislikes_count: int
    my_vote: int
    is_own_comment: bool
    is_hidden: bool
    hidden_by: Optional[str] = None
    created_at: datetime


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    next_cursor: Optional[str] = None
    has_more: bool


class CommentVoteResponse(BaseModel):
    comment_id: int
    likes_count: int
    dislikes_count: int
    my_vote: int


class HideResponse(BaseModel):
    id: int
    is_hidden: bool
    hidden_by: Optional[str] = None


class DeleteResponse(BaseModel):
    id: int
    action: Literal["hidden", "deleted"]
