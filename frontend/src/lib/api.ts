const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export interface RegistrationStatusResponse {
  is_registration_open: boolean;
  daily_limit: number;
  emails_sent_today: number;
  remaining_spots: number;
}

export interface VerifyOTPResponse {
  message: string;
  registration_token: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  is_onboarded: boolean;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string | null;
  student_id: string | null;
  college_name: string | null;
  user_id: string | null;
  campus: string | null;
  course: string | null;
  branch: string | null;
  batch: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  is_onboarded: boolean;
}

export interface OnboardingPayload {
  user_id: string;
  campus: string;
  course?: string | null;
  batch?: string | null;
  bio?: string | null;
}

export interface SafeProfile {
  user_id: string | null;
  campus: string | null;
  course: string | null;
  branch: string | null;
  batch: string | null;
  bio: string | null;
  role: string;
}

export interface UpdateProfilePayload {
  campus?: string | null;
  course?: string | null;
  branch?: string | null;
  batch?: string | null;
  bio?: string | null;
}

export interface AdminUserItem {
  id: number;
  full_name: string | null;
  student_id: string | null;
  user_id: string | null;
  campus: string | null;
  role: string;
  is_active: boolean;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
  total: number;
}

export const ALLOWED_TAGS = [
  'confession',
  'crush',
  'class',
  'hackathon',
  'hangout',
  'lost-found',
  'events',
] as const;

export type PostTag = (typeof ALLOWED_TAGS)[number];

export type PostSort = 'latest' | 'most_liked' | 'most_disliked' | 'trending';

export interface PostItem {
  id: number;
  campus: string;
  content: string;
  tags: string[];
  likes_count: number;
  dislikes_count: number;
  comments_count: number;
  my_vote: -1 | 0 | 1;
  is_own_post: boolean;
  is_hidden: boolean;
  hidden_by: string | null;
  created_at: string;
}

export interface PostFeedResponse {
  posts: PostItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface PostVoteResponse {
  post_id: number;
  likes_count: number;
  dislikes_count: number;
  my_vote: -1 | 0 | 1;
}

export interface CommentItem {
  id: number;
  post_id: number;
  campus: string;
  content: string;
  likes_count: number;
  dislikes_count: number;
  my_vote: -1 | 0 | 1;
  is_own_comment: boolean;
  is_hidden: boolean;
  hidden_by: string | null;
  created_at: string;
}

export interface CommentListResponse {
  comments: CommentItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface CommentVoteResponse {
  comment_id: number;
  likes_count: number;
  dislikes_count: number;
  my_vote: -1 | 0 | 1;
}

export interface HideResponse {
  id: number;
  is_hidden: boolean;
  hidden_by: string | null;
}

export interface DeleteResponse {
  id: number;
  action: 'hidden' | 'deleted';
}

export type FeedWsEvent =
  | {
      type: 'new_post';
      post: Omit<PostItem, 'my_vote' | 'is_own_post'>;
    }
  | {
      type: 'post_voted';
      post_id: number;
      likes_count: number;
      dislikes_count: number;
    }
  | {
      type: 'post_hidden';
      post_id: number;
      is_hidden: boolean;
      hidden_by: string | null;
    }
  | {
      type: 'post_deleted';
      post_id: number;
      action: 'hidden' | 'deleted';
    }
  | {
      type: 'new_comment';
      post_id: number;
      comments_count: number;
      comment: Omit<CommentItem, 'my_vote' | 'is_own_comment'>;
    }
  | {
      type: 'comment_voted';
      post_id: number;
      comment_id: number;
      likes_count: number;
      dislikes_count: number;
    }
  | {
      type: 'comment_hidden';
      post_id: number;
      comment_id: number;
      is_hidden: boolean;
      hidden_by: string | null;
    }
  | {
      type: 'comment_deleted';
      post_id: number;
      comment_id: number;
      action: 'hidden' | 'deleted';
      comments_count: number;
    };

export function getFeedWebSocketUrl(): string | null {
  const token = localStorage.getItem('cc_token');
  if (!token) return null;
  const wsBase = API_BASE.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/api/ws?token=${encodeURIComponent(token)}`;
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event('cc:unauthorized'));
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (
      res.status === 401 &&
      !path.startsWith('/api/auth/login') &&
      !path.startsWith('/api/auth/signup')
    ) {
      notifyUnauthorized();
    }
    const detail = typeof data?.detail === 'string'
      ? data.detail
      : Array.isArray(data?.detail)
        ? data.detail.map((e: { msg?: string }) => e.msg).join(', ')
        : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

export const api = {
  getRegistrationStatus: () =>
    request<RegistrationStatusResponse>('/api/auth/registration-status'),

  sendOtp: (email: string) =>
    request<{ message: string; email: string; expires_in_minutes: number }>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp_code: string) =>
    request<VerifyOTPResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp_code }),
    }),

  createAccount: (email: string, password: string, registration_token: string) =>
    request<TokenResponse>('/api/auth/create-account', {
      method: 'POST',
      body: JSON.stringify({ email, password, registration_token }),
    }),

  checkUserId: (user_id: string) =>
    request<{ user_id: string; is_available: boolean }>(
      `/api/auth/check-userid?user_id=${encodeURIComponent(user_id)}`
    ),

  submitOnboarding: (payload: OnboardingPayload) =>
    request<{ message: string; user: UserProfile }>('/api/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (user_name: string, user_password: string) =>
    request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_name, user_password }),
    }),

  getMe: () => request<UserProfile>('/api/auth/me'),

  getSafeProfile: () => request<SafeProfile>('/api/profile/me'),

  updateProfile: (payload: UpdateProfilePayload) =>
    request<SafeProfile>('/api/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),

  getAdminUsers: (params?: {
    search?: string;
    status_filter?: 'all' | 'active' | 'suspended';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status_filter) query.set('status_filter', params.status_filter);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<AdminUsersResponse>(`/api/profile/users${qs ? `?${qs}` : ''}`);
  },

  setUserActiveStatus: (userId: number, is_active: boolean) =>
    request<{ id: number; user_id: string | null; is_active: boolean }>(
      `/api/profile/users/${userId}/suspend`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      }
    ),

  getPosts: (params?: {
    sort?: PostSort;
    campus?: string;
    tag?: string;
    hidden_only?: boolean;
    limit?: number;
    cursor?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.sort) query.set('sort', params.sort);
    if (params?.campus) query.set('campus', params.campus);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.hidden_only) query.set('hidden_only', 'true');
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.cursor) query.set('cursor', params.cursor);
    const qs = query.toString();
    return request<PostFeedResponse>(`/api/posts${qs ? `?${qs}` : ''}`);
  },

  createPost: (content: string, tags: string[] = []) =>
    request<PostItem>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content, tags }),
    }),

  votePost: (postId: number, voteType: 1 | -1) =>
    request<PostVoteResponse>(`/api/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    }),

  toggleHidePost: (postId: number) =>
    request<HideResponse>(`/api/posts/${postId}/hide`, {
      method: 'PATCH',
    }),

  deletePost: (postId: number) =>
    request<DeleteResponse>(`/api/posts/${postId}`, {
      method: 'DELETE',
    }),

  getComments: (
    postId: number,
    params?: { limit?: number; before_id?: number }
  ) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.before_id !== undefined) query.set('before_id', String(params.before_id));
    const qs = query.toString();
    return request<CommentListResponse>(`/api/posts/${postId}/comments${qs ? `?${qs}` : ''}`);
  },

  createComment: (postId: number, content: string) =>
    request<CommentItem>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  voteComment: (commentId: number, voteType: 1 | -1) =>
    request<CommentVoteResponse>(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    }),

  toggleHideComment: (commentId: number) =>
    request<HideResponse>(`/api/comments/${commentId}/hide`, {
      method: 'PATCH',
    }),

  deleteComment: (commentId: number) =>
    request<DeleteResponse>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    }),
};
