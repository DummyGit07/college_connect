import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BarChart2, Image, Loader2, X } from 'lucide-react';
import { ALLOWED_TAGS, api, type PostItem } from '../../lib/api';
import { getTagBadgeClass } from './utils';

export interface CreatePostSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (post: PostItem) => void;
}

const MAX_CONTENT_LENGTH = 10000;
const MAX_TAGS = 3;

/**
 * Slide-up bottom sheet on mobile / centered modal on desktop for creating a new anonymous post.
 */
export function CreatePostSheet({ isOpen, onClose, onCreated }: CreatePostSheetProps) {
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        setError(null);
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, submitting]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [content]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((item) => item !== tag);
      }
      if (prev.length >= MAX_TAGS) {
        return prev;
      }
      return [...prev, tag];
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createPost(trimmed, selectedTags);
      setContent('');
      setSelectedTags([]);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200/90 bg-white shadow-xl sm:rounded-2xl dark:border-white/10 dark:bg-[#191c24]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/90 px-4 py-3 dark:border-white/10">
          <h2
            id="create-post-title"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            New anonymous post
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CONTENT_LENGTH}
            rows={4}
            placeholder="Share something with your campus..."
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />

          <div className="mt-1 flex items-center justify-end">
            <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {content.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
            </span>
          </div>

          {/* Optional Tag Selector */}
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
            <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>Tags (optional)</span>
              <span>
                {selectedTags.length}/{MAX_TAGS}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                const disabled = !active && selectedTags.length >= MAX_TAGS;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    disabled={disabled}
                    aria-pressed={active}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/25'
                        : disabled
                          ? 'cursor-not-allowed bg-zinc-100/60 text-zinc-400 dark:bg-[#111318]/60 dark:text-zinc-600'
                          : `${getTagBadgeClass(tag)} hover:opacity-85`
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
            </p>
          )}

          {/* Bottom Toolbar */}
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200/90 pt-3 dark:border-white/10">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled
                title="Image upload coming soon"
                aria-label="Add image (coming soon)"
                className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full text-zinc-300 dark:text-zinc-600"
              >
                <Image className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                title="Polls coming soon"
                aria-label="Add poll (coming soon)"
                className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full text-zinc-300 dark:text-zinc-600"
              >
                <BarChart2 className="h-4 w-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-600/25 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{submitting ? 'Posting...' : 'Post'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
