import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowBigDown,
  ArrowBigUp,
  Eye,
  EyeOff,
  Flag,
  HatGlasses,
  Loader2,
  MoreVertical,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { api, type CommentItem, type FeedWsEvent, type PostItem } from '../../lib/api';
import { formatIstDateTime, formatRelativeTime, getCampusBadgeClass } from './utils';

export interface CommentsSheetProps {
  post: PostItem | null;
  isAdmin?: boolean;
  liveEvent?: FeedWsEvent | null;
  onClose: () => void;
  onCommentAdded: (postId: number) => void;
}

const MAX_COMMENT_LENGTH = 2000;

/**
 * Slide-up bottom sheet / desktop modal displaying flat comments for a post with voting,
 * pagination ("Load more"), moderation menu, and sticky comment composer.
 */
export function CommentsSheet({
  post,
  isAdmin = false,
  liveEvent = null,
  onClose,
  onCommentAdded,
}: CommentsSheetProps) {
  if (!post) return null;

  return (
    <CommentsSheetContent
      key={post.id}
      post={post}
      isAdmin={isAdmin}
      liveEvent={liveEvent}
      onClose={onClose}
      onCommentAdded={onCommentAdded}
    />
  );
}

function CommentsSheetContent({
  post,
  isAdmin,
  liveEvent,
  onClose,
  onCommentAdded,
}: {
  post: PostItem;
  isAdmin: boolean;
  liveEvent: FeedWsEvent | null;
  onClose: () => void;
  onCommentAdded: (postId: number) => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [prevLiveEvent, setPrevLiveEvent] = useState<FeedWsEvent | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  if (liveEvent !== prevLiveEvent) {
    setPrevLiveEvent(liveEvent);
    if (liveEvent) {
      if (liveEvent.type === 'new_comment' && liveEvent.post_id === post.id) {
        setComments((prev) => {
          if (prev.some((c) => c.id === liveEvent.comment.id)) {
            return prev;
          }
          return [
            {
              ...liveEvent.comment,
              my_vote: 0,
              is_own_comment: false,
            },
            ...prev,
          ];
        });
      } else if (liveEvent.type === 'comment_voted' && liveEvent.post_id === post.id) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === liveEvent.comment_id
              ? {
                ...c,
                likes_count: liveEvent.likes_count,
                dislikes_count: liveEvent.dislikes_count,
              }
              : c
          )
        );
      } else if (liveEvent.type === 'comment_hidden' && liveEvent.post_id === post.id) {
        setComments((prev) => {
          if (!isAdmin && liveEvent.is_hidden) {
            return prev.filter((c) => c.id !== liveEvent.comment_id);
          }
          return prev.map((c) =>
            c.id === liveEvent.comment_id
              ? { ...c, is_hidden: liveEvent.is_hidden, hidden_by: liveEvent.hidden_by }
              : c
          );
        });
      } else if (liveEvent.type === 'comment_deleted' && liveEvent.post_id === post.id) {
        setComments((prev) => {
          if (!isAdmin || liveEvent.action === 'deleted') {
            return prev.filter((c) => c.id !== liveEvent.comment_id);
          }
          return prev.map((c) =>
            c.id === liveEvent.comment_id
              ? { ...c, is_hidden: true, hidden_by: 'author' }
              : c
          );
        });
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    api
      .getComments(post.id, { limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        setNextCursor(res.next_cursor);
        setHasMore(res.has_more);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load comments.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [post.id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openMenuId !== null) {
          setOpenMenuId(null);
          setConfirmDeleteId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, openMenuId]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    const beforeId = Number(nextCursor);
    if (Number.isNaN(beforeId)) return;

    setLoadingMore(true);
    try {
      const res = await api.getComments(post.id, { limit: 10, before_id: beforeId });
      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const unique = res.comments.filter((c) => !existingIds.has(c.id));
        return [...prev, ...unique];
      });
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more comments.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createComment(post.id, trimmed);
      setComments((prev) => [created, ...prev]);
      setNewComment('');
      onCommentAdded(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteComment = async (commentId: number, voteType: 1 | -1) => {
    try {
      const res = await api.voteComment(commentId, voteType);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
              ...c,
              likes_count: res.likes_count,
              dislikes_count: res.dislikes_count,
              my_vote: res.my_vote,
            }
            : c
        )
      );
    } catch {
      // Ignore transient vote errors
    }
  };

  const handleToggleHideComment = async (commentId: number) => {
    setOpenMenuId(null);
    try {
      const res = await api.toggleHideComment(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, is_hidden: res.is_hidden, hidden_by: res.hidden_by }
            : c
        )
      );
    } catch {
      // Ignore errors
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    setOpenMenuId(null);
    setConfirmDeleteId(null);
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // Ignore errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comments-sheet-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200/90 bg-white shadow-xl sm:rounded-2xl dark:border-white/10 dark:bg-[#191c24]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/90 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2
              id="comments-sheet-title"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Comments
            </h2>
            {/* <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              random from {post.campus}
            </p> */}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {comments.map((c) => {
                const isUpvoted = c.my_vote === 1;
                const isDownvoted = c.my_vote === -1;
                const menuOpen = openMenuId === c.id;
                const confirming = confirmDeleteId === c.id;

                return (
                  <div
                    key={c.id}
                    className={`py-3 first:pt-1 last:pb-1 ${c.is_hidden ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <HatGlasses
                          className="h-[18px] w-[18px] shrink-0 fill-white text-zinc-900 dark:fill-transparent dark:text-white"
                          aria-hidden="true"
                        />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          Random from
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${getCampusBadgeClass(c.campus)}`}
                        >
                          {c.campus || 'Campus'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={c.created_at} title={formatIstDateTime(c.created_at)}>
                          {formatRelativeTime(c.created_at)}
                        </time>
                        {c.is_hidden && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            <EyeOff className="h-2.5 w-2.5" />
                            Hidden
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(menuOpen ? null : c.id);
                            setConfirmDeleteId(null);
                          }}
                          aria-label="Comment options"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        {menuOpen && (
                          <div className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-zinc-200/90 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#191c24]">
                            {c.is_own_comment && !isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-red-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            )}

                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleHideComment(c.id)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                                >
                                  {c.is_hidden ? (
                                    <>
                                      <Eye className="h-3.5 w-3.5" />
                                      Unhide
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-3.5 w-3.5" />
                                      Hide
                                    </>
                                  )}
                                </button>

                                {!confirming ? (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(c.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-red-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete permanently
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="flex w-full items-center gap-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-left text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Confirm delete?
                                  </button>
                                )}
                              </>
                            )}

                            {!c.is_own_comment && !isAdmin && (
                              <button
                                type="button"
                                disabled
                                className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Flag className="h-3.5 w-3.5" />
                                  Report
                                </span>
                                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  Soon
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
                      {c.content}
                    </p>

                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleVoteComment(c.id, 1)}
                        aria-label="Upvote comment"
                        aria-pressed={isUpvoted}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${isUpvoted
                          ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400'
                          }`}
                      >
                        <ArrowBigUp className={`h-3.5 w-3.5 ${isUpvoted ? 'fill-current' : ''}`} />
                        <span>{c.likes_count}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleVoteComment(c.id, -1)}
                        aria-label="Downvote comment"
                        aria-pressed={isDownvoted}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${isDownvoted
                          ? 'bg-red-500/12 text-red-600 dark:text-red-400'
                          : 'text-zinc-500 hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400'
                          }`}
                      >
                        <ArrowBigDown
                          className={`h-3.5 w-3.5 ${isDownvoted ? 'fill-current' : ''}`}
                        />
                        <span>{c.dislikes_count}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300 dark:hover:bg-[#222631]"
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{loadingMore ? 'Loading...' : 'Load more'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Sticky Bottom Input */}
        <form
          onSubmit={handleSubmit}
          className="flex shrink-0 items-center gap-2 border-t border-zinc-200/90 px-3 py-2.5 dark:border-white/10"
        >
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Write an anonymous comment..."
            className="h-9 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-[#111318] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            aria-label="Send comment"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/25 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
