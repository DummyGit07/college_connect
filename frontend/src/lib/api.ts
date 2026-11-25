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
};
