import { useEffect, useRef, useState } from 'react';
import {
  ArrowBigDown,
  ArrowBigUp,
  Bookmark,
  Eye,
  EyeOff,
  Flag,
  HatGlasses,
  MessageSquare,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import type { PostItem } from '../../lib/api';
import {
  formatIstDateTime,
  formatRelativeTime,
  getCampusBadgeClass,
  getTagBadgeClass,
} from './utils';

export interface PostCardProps {
  post: PostItem;
  isAdmin?: boolean;
  onVote: (postId: number, voteType: 1 | -1) => void;
  onCommentClick: (post: PostItem) => void;
  onDelete: (postId: number) => void;
  onToggleHide?: (postId: number) => void;
}

const CONTENT_COLLAPSE_LIMIT = 300;

/**
 * Anonymous feed post card with voting, tag pills, expandable content, and moderation menu.
 */
export function PostCard({
  post,
  isAdmin = false,
  onVote,
  onCommentClick,
  onDelete,
  onToggleHide,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const isLong = post.content.length > CONTENT_COLLAPSE_LIMIT;
  const displayedContent =
    isLong && !expanded
      ? `${post.content.slice(0, CONTENT_COLLAPSE_LIMIT).trimEnd()}...`
      : post.content;

  const isUpvoted = post.my_vote === 1;
  const isDownvoted = post.my_vote === -1;

  return (
    <article
      className={`rounded-2xl border border-zinc-200/90 bg-white p-4 transition-colors dark:border-white/10 dark:bg-[#191c24] ${post.is_hidden ? 'opacity-75' : ''
        }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <HatGlasses
            className="h-[18px] w-[18px] shrink-0 fill-white text-zinc-900 dark:fill-transparent dark:text-white"
            aria-hidden="true"
          />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Random NPC from</span>
          <span
            className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${getCampusBadgeClass(post.campus)}`}
          >
            {post.campus || 'Campus'}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.created_at} title={formatIstDateTime(post.created_at)}>
            {formatRelativeTime(post.created_at)}
          </time>
          {post.is_hidden && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              <EyeOff className="h-3 w-3" />
              Hidden
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getTagBadgeClass(tag)}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen((prev) => !prev);
                setConfirmDelete(false);
              }}
              aria-label="Post options"
              aria-expanded={menuOpen}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-zinc-200/90 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#191c24]">
                {post.is_own_post && !isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(post.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleHide?.(post.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                    >
                      {post.is_hidden ? (
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

                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete permanently
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmDelete(false);
                          onDelete(post.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg bg-red-500/10 px-2.5 py-2 text-left text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Confirm delete?
                      </button>
                    )}
                  </>
                )}

                {!post.is_own_post && !isAdmin && (
                  <button
                    type="button"
                    disabled
                    title="Reporting coming soon"
                    className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Flag className="h-3.5 w-3.5" />
                      Report
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Soon
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-2.5">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100">
          {displayedContent}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Action Bar */}
      <div className="mt-3.5 flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-800/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onVote(post.id, 1)}
            aria-label="Upvote"
            aria-pressed={isUpvoted}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${isUpvoted
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
              : 'text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400'
              }`}
          >
            <ArrowBigUp className={`h-4 w-4 ${isUpvoted ? 'fill-current' : ''}`} />
            <span>{post.likes_count}</span>
          </button>

          <button
            type="button"
            onClick={() => onVote(post.id, -1)}
            aria-label="Downvote"
            aria-pressed={isDownvoted}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${isDownvoted
              ? 'bg-red-500/12 text-red-600 dark:text-red-400'
              : 'text-zinc-500 hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400'
              }`}
          >
            <ArrowBigDown className={`h-4 w-4 ${isDownvoted ? 'fill-current' : ''}`} />
            <span>{post.dislikes_count}</span>
          </button>

          <button
            type="button"
            onClick={() => onCommentClick(post)}
            aria-label="Comments"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{post.comments_count}</span>
          </button>
        </div>

        <button
          type="button"
          disabled
          title="Bookmarks coming soon"
          aria-label="Bookmark (coming soon)"
          className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full text-zinc-300 dark:text-zinc-600"
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
