import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  PlusSquare,
  RotateCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  api,
  getFeedWebSocketUrl,
  notifyUnauthorized,
  type FeedWsEvent,
  type PostItem,
  type PostSort,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { FilterBar } from '../components/feed/FilterBar';
import { PostCard } from '../components/feed/PostCard';
import { CreatePostSheet } from '../components/feed/CreatePostSheet';
import { CommentsSheet } from '../components/feed/CommentsSheet';

function FeedSkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200/90 bg-white p-4 dark:border-white/10 dark:bg-[#191c24]">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-36 rounded-full bg-zinc-200 dark:bg-white/10" />
        <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-white/10" />
      </div>
      <div className="mt-3.5 space-y-2">
        <div className="h-3.5 w-full rounded bg-zinc-200 dark:bg-white/10" />
        <div className="h-3.5 w-5/6 rounded bg-zinc-200 dark:bg-white/10" />
        <div className="h-3.5 w-2/3 rounded bg-zinc-200 dark:bg-white/10" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-7 w-14 rounded-full bg-zinc-200 dark:bg-white/10" />
        <div className="h-7 w-14 rounded-full bg-zinc-200 dark:bg-white/10" />
        <div className="h-7 w-14 rounded-full bg-zinc-200 dark:bg-white/10" />
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [sort, setSort] = useState<PostSort>('latest');
  const [campus, setCampus] = useState('');
  const [tag, setTag] = useState('');
  const [hiddenOnly, setHiddenOnly] = useState(false);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [pendingNewPosts, setPendingNewPosts] = useState<PostItem[]>([]);
  const [lastWsEvent, setLastWsEvent] = useState<FeedWsEvent | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeCommentsPost, setActiveCommentsPost] = useState<PostItem | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);
  const countedCommentIdsRef = useRef<Set<number>>(new Set());

  const isAdmin = user?.role === 'admin';

  // Refs for WebSocket handler so filter/role changes don't tear down the socket
  const sortRef = useRef(sort);
  const campusRef = useRef(campus);
  const tagRef = useRef(tag);
  const isAdminRef = useRef(isAdmin);
  const hiddenOnlyRef = useRef(hiddenOnly);

  useEffect(() => {
    sortRef.current = sort;
    campusRef.current = campus;
    tagRef.current = tag;
    isAdminRef.current = isAdmin;
    hiddenOnlyRef.current = hiddenOnly;
  }, [sort, campus, tag, isAdmin, hiddenOnly]);

  const handleSortChange = (nextSort: PostSort) => {
    setLoadingInitial(true);
    setError(null);
    setPendingNewPosts([]);
    setSort(nextSort);
  };

  const handleCampusChange = (nextCampus: string) => {
    setLoadingInitial(true);
    setError(null);
    setPendingNewPosts([]);
    setCampus(nextCampus);
  };

  const handleTagChange = (nextTag: string) => {
    setLoadingInitial(true);
    setError(null);
    setPendingNewPosts([]);
    setTag(nextTag);
  };

  const handleHiddenOnlyChange = (nextHiddenOnly: boolean) => {
    setLoadingInitial(true);
    setError(null);
    setPendingNewPosts([]);
    setHiddenOnly(nextHiddenOnly);
  };

  const handleRefresh = useCallback(async () => {
    if (!user || !user.is_onboarded) return;
    const currentFetchId = ++fetchIdRef.current;
    setRefreshing(true);
    setError(null);
    setPendingNewPosts([]);

    try {
      const res = await api.getPosts({
        sort,
        campus: campus || undefined,
        tag: tag || undefined,
        hidden_only: isAdmin && hiddenOnly ? true : undefined,
        limit: 20,
      });
      if (currentFetchId !== fetchIdRef.current) return;
      setPosts(res.posts);
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      if (currentFetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load posts.');
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoadingInitial(false);
        setRefreshing(false);
      }
    }
  }, [user, sort, campus, tag, isAdmin, hiddenOnly]);

  useEffect(() => {
    if (!user || !user.is_onboarded) return;
    const currentFetchId = ++fetchIdRef.current;

    api
      .getPosts({
        sort,
        campus: campus || undefined,
        tag: tag || undefined,
        hidden_only: isAdmin && hiddenOnly ? true : undefined,
        limit: 20,
      })
      .then((res) => {
        if (currentFetchId !== fetchIdRef.current) return;
        setPosts(res.posts);
        setNextCursor(res.next_cursor);
        setHasMore(res.has_more);
        setError(null);
      })
      .catch((err) => {
        if (currentFetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load posts.');
      })
      .finally(() => {
        if (currentFetchId === fetchIdRef.current) {
          setLoadingInitial(false);
          setRefreshing(false);
        }
      });
  }, [user, sort, campus, tag, isAdmin, hiddenOnly]);

  // Real-time WebSocket connection with silent exponential-backoff reconnect
  useEffect(() => {
    if (!user || !user.is_onboarded) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let backoffMs = 1000;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const url = getFeedWebSocketUrl();
      if (!url) return;

      ws = new WebSocket(url);

      ws.onopen = () => {
        backoffMs = 1000;
      };

      ws.onmessage = (msg) => {
        let event: FeedWsEvent;
        try {
          event = JSON.parse(msg.data) as FeedWsEvent;
        } catch {
          return;
        }

        switch (event.type) {
          case 'new_post': {
            const incoming: PostItem = {
              ...event.post,
              my_vote: 0,
              is_own_post: false,
            };
            if (hiddenOnlyRef.current && !incoming.is_hidden) return;
            const matchesSort = sortRef.current === 'latest';
            const matchesCampus = !campusRef.current || incoming.campus === campusRef.current;
            const matchesTag = !tagRef.current || incoming.tags.includes(tagRef.current);

            if (!matchesSort || !matchesCampus || !matchesTag) return;

            if (window.scrollY < 160) {
              setPosts((prev) =>
                prev.some((p) => p.id === incoming.id) ? prev : [incoming, ...prev]
              );
            } else {
              setPendingNewPosts((prev) =>
                prev.some((p) => p.id === incoming.id) ? prev : [incoming, ...prev]
              );
            }
            break;
          }

          case 'post_voted': {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === event.post_id
                  ? { ...p, likes_count: event.likes_count, dislikes_count: event.dislikes_count }
                  : p
              )
            );
            setPendingNewPosts((prev) =>
              prev.map((p) =>
                p.id === event.post_id
                  ? { ...p, likes_count: event.likes_count, dislikes_count: event.dislikes_count }
                  : p
              )
            );
            break;
          }

          case 'post_hidden': {
            if (
              (!isAdminRef.current && event.is_hidden) ||
              (hiddenOnlyRef.current && !event.is_hidden)
            ) {
              setPosts((prev) => prev.filter((p) => p.id !== event.post_id));
              setPendingNewPosts((prev) => prev.filter((p) => p.id !== event.post_id));
              setActiveCommentsPost((prev) => (prev?.id === event.post_id ? null : prev));
            } else {
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === event.post_id
                    ? { ...p, is_hidden: event.is_hidden, hidden_by: event.hidden_by }
                    : p
                )
              );
              setPendingNewPosts((prev) =>
                prev.map((p) =>
                  p.id === event.post_id
                    ? { ...p, is_hidden: event.is_hidden, hidden_by: event.hidden_by }
                    : p
                )
              );
            }
            break;
          }

          case 'post_deleted': {
            if (event.action === 'deleted' || !isAdminRef.current) {
              setPosts((prev) => prev.filter((p) => p.id !== event.post_id));
              setPendingNewPosts((prev) => prev.filter((p) => p.id !== event.post_id));
              setActiveCommentsPost((prev) => (prev?.id === event.post_id ? null : prev));
            } else {
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === event.post_id ? { ...p, is_hidden: true, hidden_by: 'author' } : p
                )
              );
            }
            break;
          }

          case 'new_comment': {
            countedCommentIdsRef.current.add(event.comment.id);
            setPosts((prev) =>
              prev.map((p) =>
                p.id === event.post_id ? { ...p, comments_count: event.comments_count } : p
              )
            );
            setActiveCommentsPost((prev) =>
              prev && prev.id === event.post_id
                ? { ...prev, comments_count: event.comments_count }
                : prev
            );
            setLastWsEvent(event);
            break;
          }

          case 'comment_deleted': {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === event.post_id ? { ...p, comments_count: event.comments_count } : p
              )
            );
            setActiveCommentsPost((prev) =>
              prev && prev.id === event.post_id
                ? { ...prev, comments_count: event.comments_count }
                : prev
            );
            setLastWsEvent(event);
            break;
          }

          case 'comment_voted':
          case 'comment_hidden': {
            setLastWsEvent(event);
            break;
          }
        }
      };

      ws.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4001) {
          disposed = true;
          notifyUnauthorized();
          return;
        }
        const delay = backoffMs;
        backoffMs = Math.min(backoffMs * 2, 30000);
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, [user]);

  const loadMorePosts = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore || loadingInitial) return;
    const currentFetchId = fetchIdRef.current;
    setLoadingMore(true);

    try {
      const res = await api.getPosts({
        sort,
        campus: campus || undefined,
        tag: tag || undefined,
        hidden_only: isAdmin && hiddenOnly ? true : undefined,
        limit: 10,
        cursor: nextCursor,
      });
      if (currentFetchId !== fetchIdRef.current) return;
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const uniqueNew = res.posts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...uniqueNew];
      });
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch {
      // Keep existing posts if pagination fails silently
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [hasMore, nextCursor, loadingMore, loadingInitial, sort, campus, tag, isAdmin, hiddenOnly]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMorePosts();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePosts]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#eef1f6] dark:bg-[#111318]">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!user.is_onboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleVote = async (postId: number, voteType: 1 | -1) => {
    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    const previous = target;
    const isTogglingOff = target.my_vote === voteType;
    const nextVote: -1 | 0 | 1 = isTogglingOff ? 0 : voteType;

    let nextLikes = target.likes_count;
    let nextDislikes = target.dislikes_count;
    if (target.my_vote === 1) nextLikes = Math.max(0, nextLikes - 1);
    if (target.my_vote === -1) nextDislikes = Math.max(0, nextDislikes - 1);
    if (nextVote === 1) nextLikes += 1;
    if (nextVote === -1) nextDislikes += 1;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes_count: nextLikes, dislikes_count: nextDislikes, my_vote: nextVote }
          : p
      )
    );

    try {
      const updated = await api.votePost(postId, voteType);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
              ...p,
              likes_count: updated.likes_count,
              dislikes_count: updated.dislikes_count,
              my_vote: updated.my_vote,
            }
            : p
        )
      );
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === postId ? previous : p)));
    }
  };

  const handleToggleHide = async (postId: number) => {
    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    const previous = target;
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_hidden: !p.is_hidden } : p))
    );

    try {
      const res = await api.toggleHidePost(postId);
      if (hiddenOnly && !res.is_hidden) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_hidden: res.is_hidden, hidden_by: res.hidden_by } : p
          )
        );
      }
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === postId ? previous : p)));
    }
  };

  const handleDelete = async (postId: number) => {
    const previousPosts = posts;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (activeCommentsPost?.id === postId) {
      setActiveCommentsPost(null);
    }

    try {
      await api.deletePost(postId);
    } catch {
      setPosts(previousPosts);
    }
  };

  const handleCreated = (newPost: PostItem) => {
    const matchesCampus = !campus || newPost.campus === campus;
    const matchesTag = !tag || newPost.tags.includes(tag);
    if (matchesCampus && matchesTag) {
      setPosts((prev) => (prev.some((p) => p.id === newPost.id) ? prev : [newPost, ...prev]));
    }
  };

  const handleCommentAdded = (postId: number, commentId: number) => {
    if (countedCommentIdsRef.current.has(commentId)) return;
    countedCommentIdsRef.current.add(commentId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
    );
    setActiveCommentsPost((prev) =>
      prev && prev.id === postId ? { ...prev, comments_count: prev.comments_count + 1 } : prev
    );
  };

  const handleShowPendingPosts = () => {
    if (pendingNewPosts.length === 0) return;
    setPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const uniqueNew = pendingNewPosts.filter((p) => !existingIds.has(p.id));
      return [...uniqueNew, ...prev];
    });
    setPendingNewPosts([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-[#eef1f6] text-zinc-900 dark:bg-[#111318] dark:text-zinc-100">
      <Navbar />

      {/* Main Shell */}
      <div className="mx-auto flex max-w-5xl gap-6 px-4 pt-4">
        {/* Desktop Left Rail (4 items) */}
        <aside className="hidden lg:block lg:w-60 lg:shrink-0">
          <div className="sticky top-20 space-y-4">
            <nav
              aria-label="Primary navigation"
              className="space-y-1.5 rounded-2xl border border-zinc-200/90 bg-white p-2 dark:border-white/10 dark:bg-[#191c24]"
            >
              <button
                type="button"
                onClick={scrollToTop}
                className="flex w-full items-center gap-3 rounded-xl bg-violet-500/12 px-3 py-2.5 text-sm font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
              >
                <Home className="h-4 w-4" />
                <span>Feed</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/25 transition hover:brightness-110"
              >
                <PlusSquare className="h-4 w-4" />
                <span>Yapp</span>
              </button>

              <button
                type="button"
                disabled
                title="Personal chat coming soon"
                className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 opacity-60 dark:text-zinc-500"
              >
                <span className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4" />
                  <span>DMs</span>
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#222631] cursor-pointer"
              >
                <User className="h-4 w-4" />
                <span>Main Character</span>
              </button>
            </nav>

            {/* Quick Campus & Role Card */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 dark:border-white/10 dark:bg-[#191c24]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  @{user.user_id || 'student'}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-700 dark:bg-[#111318] dark:text-zinc-300">
                  <ShieldCheck className="h-3 w-3 text-violet-500" />
                  {user.role}
                </span>
              </div>
              {user.campus && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span className="truncate">{user.campus} Campus</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Feed Column */}
        <main className="min-w-0 flex-1 pb-24 lg:pb-10">
          <div className="mx-auto max-w-xl space-y-3">
            <FilterBar
              sort={sort}
              onSortChange={handleSortChange}
              campus={campus}
              onCampusChange={handleCampusChange}
              tag={tag}
              onTagChange={handleTagChange}
              isAdmin={isAdmin}
              hiddenOnly={hiddenOnly}
              onHiddenOnlyChange={handleHiddenOnlyChange}
            />

            {/* Floating New Posts Pill */}
            {pendingNewPosts.length > 0 && (
              <div className="sticky top-16 z-20 flex justify-center">
                <button
                  type="button"
                  onClick={handleShowPendingPosts}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-violet-600/25 transition hover:brightness-110"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span>New posts · Tap to show ({pendingNewPosts.length})</span>
                </button>
              </div>
            )}

            {/* Subtle Meta Row */}
            <div className="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>Posts auto-expire in 7d</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loadingInitial}
                title="Refresh feed"
                aria-label="Refresh feed"
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
              >
                <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-[#191c24] dark:text-red-400">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-2 text-xs font-medium underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {loadingInitial ? (
              <div className="space-y-3">
                <FeedSkeletonCard />
                <FeedSkeletonCard />
                <FeedSkeletonCard />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200/90 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-[#191c24]">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  No posts yet
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {campus || tag
                    ? 'Try clearing your filters or be the first to post here.'
                    : 'Be the first to share something with your campus.'}
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm shadow-violet-600/25 transition hover:brightness-110"
                >
                  <PlusSquare className="h-3.5 w-3.5" />
                  <span>Create Post</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isAdmin={isAdmin}
                    onVote={handleVote}
                    onCommentClick={(selected) => setActiveCommentsPost(selected)}
                    onDelete={handleDelete}
                    onToggleHide={isAdmin ? handleToggleHide : undefined}
                  />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400 dark:text-zinc-500" />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation (4 items) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/90 bg-[#eef1f6]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#111318]/85"
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Home"
            className="flex h-10 w-12 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          >
            <Home className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            aria-label="Create post"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-xs font-semibold text-white shadow-sm shadow-violet-600/25 transition hover:brightness-110"
          >
            {/* <PlusSquare className="h-4 w-4" /> */}
            <span>Yapp</span>
          </button>

          <button
            type="button"
            disabled
            title="Personal chat coming soon"
            aria-label="Personal chat coming soon"
            className="relative flex h-10 w-12 cursor-not-allowed items-center justify-center rounded-xl text-zinc-400 opacity-60 dark:text-zinc-500"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="absolute top-2.5 right-3 h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Profile"
            className="flex h-10 w-12 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-white/10 cursor-pointer"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Sheets / Modals */}
      <CreatePostSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />

      <CommentsSheet
        post={activeCommentsPost}
        isAdmin={isAdmin}
        liveEvent={lastWsEvent}
        onClose={() => setActiveCommentsPost(null)}
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
}
