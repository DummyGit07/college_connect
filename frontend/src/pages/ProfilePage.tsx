import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Lock,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, ApiError, type AdminUserItem, type SafeProfile } from '../lib/api';

const CAMPUSES = ['Bhimtal', 'Haldwani', 'Dehradun'] as const;

const COURSES = [
  'B.Tech',
  'BCA',
  'BBA',
  'MBA',
  'MCA',
  'B.Sc',
  'B.Com',
  'B.A',
  'M.Tech',
  'Other',
] as const;

type SectionKey = 'general' | 'settings' | 'users';

function IncognitoAvatar() {
  return (
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/12 text-violet-600 shadow-sm dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-300">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
        aria-hidden="true"
      >
        <path d="M3 11h18" />
        <path d="M5 11l1.7-5.1A2 2 0 0 1 8.6 4.5h6.8a2 2 0 0 1 1.9 1.4L19 11" />
        <circle cx="7.5" cy="16" r="2.8" />
        <circle cx="16.5" cy="16" r="2.8" />
        <path d="M10.3 16h3.4" />
      </svg>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, isLoading, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [profile, setProfile] = useState<SafeProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Desktop defaults to 'general'; Mobile starts on menu (null) and opens a section on tap
  const [activeTab, setActiveTab] = useState<SectionKey>('general');
  const [mobileSection, setMobileSection] = useState<SectionKey | null>(null);
  const [openGeneralCard, setOpenGeneralCard] = useState<'stats' | 'password' | null>(null);

  const [copiedHandle, setCopiedHandle] = useState(false);
  const [themeToast, setThemeToast] = useState<{ id: number; message: string } | null>(null);
  const themeToastTimerRef = useRef<number | null>(null);

  // General form state
  const [campus, setCampus] = useState('');
  const [course, setCourse] = useState('');
  const [branch, setBranch] = useState('');
  const [batch, setBatch] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Admin users state
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [adminTotal, setAdminTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  const isAdmin = (profile?.role ?? user?.role) === 'admin';

  const hasProfileChanges = Boolean(
    profile &&
    (campus !== (profile.campus || '') ||
      course !== (profile.course || '') ||
      branch.trim() !== (profile.branch || '') ||
      batch.trim() !== (profile.batch || '') ||
      bio.trim() !== (profile.bio || ''))
  );

  const isPasswordFormFilled =
    currentPassword.trim().length > 0 &&
    newPassword.trim().length > 0 &&
    confirmPassword.trim().length > 0;

  useEffect(() => {
    if (!user?.is_onboarded) return;
    let active = true;
    setLoadingProfile(true);
    setProfileError(null);

    api
      .getSafeProfile()
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setCampus(data.campus || '');
        setCourse(data.course || '');
        setBranch(data.branch || '');
        setBatch(data.batch || '');
        setBio(data.bio || '');
      })
      .catch((err) => {
        if (!active) return;
        setProfileError(err instanceof ApiError ? err.message : 'Failed to load profile.');
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [user?.is_onboarded]);

  useEffect(() => {
    if (!isAdmin) return;
    const isViewingUsers = activeTab === 'users' || mobileSection === 'users';
    if (!isViewingUsers) return;

    let active = true;
    setLoadingUsers(true);
    setUsersError(null);

    const timer = setTimeout(() => {
      api
        .getAdminUsers({
          search: userSearch.trim() || undefined,
          status_filter: statusFilter,
          limit: 50,
          offset: 0,
        })
        .then((res) => {
          if (!active) return;
          setAdminUsers(res.users);
          setAdminTotal(res.total);
        })
        .catch((err) => {
          if (!active) return;
          setUsersError(err instanceof ApiError ? err.message : 'Failed to load users.');
        })
        .finally(() => {
          if (active) setLoadingUsers(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isAdmin, activeTab, mobileSection, userSearch, statusFilter]);

  if (!isLoading && !user) {
    return <Navigate to="/signin" replace />;
  }

  if (!isLoading && user && !user.is_onboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleCopyUserId = async () => {
    if (!profile?.user_id) return;
    try {
      await navigator.clipboard.writeText(`@${profile.user_id}`);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 1800);
    } catch {
      // Clipboard API may be blocked in insecure contexts
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!campus) {
      setSaveError('Please select a campus.');
      return;
    }

    setSavingProfile(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const updated = await api.updateProfile({
        campus,
        course: course || null,
        branch: branch.trim() || null,
        batch: batch.trim() || null,
        bio: bio.trim() || null,
      });
      setProfile(updated);
      await refreshUser();
      setSaveMessage('Profile updated.');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (!currentPassword.trim()) {
      setPasswordError('Current password is required.');
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordError('New password must be at least 8 non-space characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setPasswordMessage(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleSuspend = async (target: AdminUserItem) => {
    if (target.id === user?.id) return;
    setTogglingUserId(target.id);
    setUsersError(null);

    try {
      const res = await api.setUserActiveStatus(target.id, !target.is_active);
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === res.id ? { ...u, is_active: res.is_active } : u))
      );
    } catch (err) {
      setUsersError(err instanceof ApiError ? err.message : 'Failed to update user status.');
    } finally {
      setTogglingUserId(null);
    }
  };

  const openSection = (section: SectionKey) => {
    setActiveTab(section);
    setMobileSection(section);
  };

  useEffect(() => {
    return () => {
      if (themeToastTimerRef.current !== null) {
        window.clearTimeout(themeToastTimerRef.current);
      }
    };
  }, []);

  const handleSelectTheme = (nextTheme: 'light' | 'dark') => {
    if (theme !== nextTheme) {
      toggleTheme();
    }
    const message =
      nextTheme === 'dark'
        ? 'It\'s dark. Like your Career 💀'
        : 'It\'s light. Unlike your future 😭';
    const toastId = Date.now();
    setThemeToast({ id: toastId, message });
    if (themeToastTimerRef.current !== null) {
      window.clearTimeout(themeToastTimerRef.current);
    }
    themeToastTimerRef.current = window.setTimeout(() => {
      setThemeToast((prev) => (prev?.id === toastId ? null : prev));
    }, 3300);
  };

  const renderGeneralSection = () => {
    const isStatsOpen = openGeneralCard === 'stats';
    const isPasswordOpen = openGeneralCard === 'password';
    const statsPreview = [
      profile?.user_id ? `@${profile.user_id}` : null,
      profile?.campus || null,
      profile?.course || null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#191c24]">
          <button
            type="button"
            aria-expanded={isStatsOpen}
            onClick={() => setOpenGeneralCard((prev) => (prev === 'stats' ? null : 'stats'))}
            className="flex min-h-[60px] w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer"
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Your Character Stats:
              </h2>
              {statsPreview && (
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {statsPreview}
                </p>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${isStatsOpen ? 'rotate-180' : ''
                }`}
            />
          </button>

          {isStatsOpen && (
            <form
              onSubmit={handleSaveProfile}
              className="border-t border-zinc-200/80 px-5 pb-5 pt-4 dark:border-white/10"
            >
              {saveError && (
                <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-400">
                  {saveError}
                </div>
              )}
              {saveMessage && (
                <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                  {saveMessage}
                </div>
              )}

              <div className="space-y-4">
                {/* Locked User ID */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Your Anonymous ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={profile?.user_id ? `@${profile.user_id}` : ''}
                      className="w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100/80 py-2.5 pl-3.5 pr-10 text-sm text-zinc-500 outline-none dark:border-white/10 dark:bg-[#111318]/70 dark:text-zinc-400"
                    />
                    <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  </div>
                </div>

                {/* Campus */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Which Campus?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CAMPUSES.map((c) => {
                      const selected = campus === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCampus(c)}
                          className={`min-h-[44px] rounded-xl border px-2 text-xs font-medium transition cursor-pointer ${selected
                            ? 'border-violet-500 bg-violet-500/12 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300 dark:hover:bg-[#222631]'
                            }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Course & Branch */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Which Course?
                    </label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                    >
                      <option value="">Select course</option>
                      {COURSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Which Branch?
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. CSE"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                    />
                  </div>
                </div>

                {/* Batch */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Which Batch?
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="e.g. 2022-2026"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Bio
                  </label>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your existence in 150 characters..."
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile || !hasProfileChanges || !campus}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  Lock it
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Change Password */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#191c24]">
          <button
            type="button"
            aria-expanded={isPasswordOpen}
            onClick={() =>
              setOpenGeneralCard((prev) => (prev === 'password' ? null : 'password'))
            }
            className="flex min-h-[60px] w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer"
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Change Password
              </h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                Update your account password
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${isPasswordOpen ? 'rotate-180' : ''
                }`}
            />
          </button>

          {isPasswordOpen && (
            <form
              onSubmit={handleChangePassword}
              className="border-t border-zinc-200/80 px-5 pb-5 pt-4 dark:border-white/10"
            >
              {passwordError && (
                <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-400">
                  {passwordError}
                </div>
              )}
              {passwordMessage && (
                <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                  {passwordMessage}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={changingPassword || !isPasswordFormFilled}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
                >
                  {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div >
    );
  };

  const renderSettingsSection = () => (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#191c24]">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Set the Vibe</h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSelectTheme('light')}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${theme === 'light'
            ? 'border-violet-500 bg-violet-500/12 text-violet-700'
            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300 dark:hover:bg-[#222631]'
            }`}
        >
          <Sun className="h-4 w-4" />
          Light
        </button>

        <button
          type="button"
          onClick={() => handleSelectTheme('dark')}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${theme === 'dark'
            ? 'border-violet-500 bg-violet-500/20 text-violet-300'
            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300'
            }`}
        >
          <Moon className="h-4 w-4" />
          Dark
        </button>
      </div>
    </div >
  );

  const renderUsersSection = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#191c24]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Users ({adminTotal})
          </h2>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search @user_id, name, or student ID..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(['all', 'active', 'suspended'] as const).map((statusKey) => {
            const active = statusFilter === statusKey;
            return (
              <button
                key={statusKey}
                type="button"
                onClick={() => setStatusFilter(statusKey)}
                className={`min-h-[36px] rounded-full px-3.5 text-xs font-medium capitalize transition cursor-pointer ${active
                  ? 'bg-violet-600 text-white'
                  : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300'
                  }`}
              >
                {statusKey}
              </button>
            );
          })}
        </div>
      </div>

      {usersError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
          {usersError}
        </div>
      )}

      {loadingUsers ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      ) : adminUsers.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#191c24] dark:text-zinc-400">
          No users match your filter.
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {adminUsers.map((u) => {
              const isSelf = u.id === user?.id;
              return (
                <div
                  key={u.id}
                  className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#191c24]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {u.user_id ? `@${u.user_id}` : '(not onboarded)'}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-normal text-zinc-500">(You)</span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">
                        {u.full_name || '—'} · {u.student_id || '—'}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {u.campus || 'No campus'} · <span className="capitalize">{u.role}</span>
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.is_active
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                        }`}
                    >
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSelf || togglingUserId === u.id}
                      onClick={() => handleToggleSuspend(u)}
                      className={`min-h-[42px] rounded-xl px-3 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${u.is_active
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                        : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                        }`}
                    >
                      {togglingUserId === u.id
                        ? 'Updating...'
                        : u.is_active
                          ? 'Block User'
                          : 'Unblock User'}
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Delete account coming soon"
                      className="inline-flex min-h-[42px] cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-medium text-zinc-400 opacity-60 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm md:block dark:border-white/10 dark:bg-[#191c24]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200/90 bg-zinc-50/80 text-zinc-500 dark:border-white/10 dark:bg-[#111318]/60 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">User ID</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Student ID</th>
                    <th className="px-4 py-3 font-medium">Campus</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70 dark:divide-white/10">
                  {adminUsers.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {u.user_id ? `@${u.user_id}` : '—'}
                          {isSelf && (
                            <span className="ml-1.5 text-[11px] font-normal text-zinc-500">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {u.full_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {u.student_id || '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {u.campus || '—'}
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">
                          {u.role}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${u.is_active
                              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                              }`}
                          >
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isSelf || togglingUserId === u.id}
                              onClick={() => handleToggleSuspend(u)}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${u.is_active
                                ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                                : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                                }`}
                            >
                              {togglingUserId === u.id
                                ? '...'
                                : u.is_active
                                  ? 'Block'
                                  : 'Unblock'}
                            </button>

                            <button
                              type="button"
                              disabled
                              title="Delete account coming soon"
                              className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 opacity-60 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-500"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#eef1f6] text-zinc-900 dark:bg-[#111318] dark:text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-5 pb-12">
        {/* Top Back Navigation */}
        <div className="mb-4 flex items-center justify-between">
          {mobileSection ? (
            <button
              type="button"
              onClick={() => setMobileSection(null)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/70 md:hidden dark:text-zinc-300 dark:hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to chaos
            </button>
          )}

          {mobileSection && (
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="hidden min-h-[40px] items-center gap-1.5 rounded-full px-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/70 md:inline-flex dark:text-zinc-300 dark:hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to chaos
            </button>
          )}
        </div>

        {loadingProfile ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
          </div>
        ) : profileError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-600 dark:text-rose-400">
            {profileError}
          </div>
        ) : (
          <>
            {/* Profile Header (Always shown on desktop; shown on mobile root view) */}
            <div className={`${mobileSection ? 'hidden md:block' : 'block'} mb-6 text-center`}>
              <IncognitoAvatar />
              <div className="mt-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3.5 py-1 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-[#191c24] dark:text-zinc-100 dark:hover:bg-[#222631] cursor-pointer"
                >
                  <span>@{profile?.user_id || 'anonymous'}</span>
                  {copiedHandle ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                </button>
              </div>
              {copiedHandle && (
                <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Copied to clipboard
                </p>
              )}
            </div>

            {/* Mobile Menu List (shown when no sub-section is open) */}
            {!mobileSection && (
              <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm md:hidden dark:border-white/10 dark:bg-[#191c24]">
                <button
                  type="button"
                  onClick={() => openSection('general')}
                  className="flex min-h-[56px] w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <UserIcon className="h-4 w-4 text-violet-500" />
                    General
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </button>

                <div className="h-px bg-zinc-200/80 dark:bg-white/10" />

                <button
                  type="button"
                  onClick={() => openSection('settings')}
                  className="flex min-h-[56px] w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <Settings className="h-4 w-4 text-violet-500" />
                    Control Room
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </button>

                {isAdmin && (
                  <>
                    <div className="h-px bg-zinc-200/80 dark:bg-white/10" />
                    <button
                      type="button"
                      onClick={() => openSection('users')}
                      className="flex min-h-[56px] w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer"
                    >
                      <span className="flex items-center gap-3 text-sm font-medium">
                        <Shield className="h-4 w-4 text-violet-500" />
                        Users
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Mobile Active Sub-view */}
            {mobileSection && (
              <div className="md:hidden">
                {mobileSection === 'general' && renderGeneralSection()}
                {mobileSection === 'settings' && renderSettingsSection()}
                {mobileSection === 'users' && isAdmin && renderUsersSection()}
              </div>
            )}

            {/* Desktop Split Layout */}
            <div className="hidden gap-6 md:grid md:grid-cols-[220px_1fr]">
              <aside>
                <nav className="space-y-1 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[#191c24]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition cursor-pointer ${activeTab === 'general'
                      ? 'bg-violet-500/12 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#222631]'
                      }`}
                  >
                    <UserIcon className="h-4 w-4" />
                    General
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition cursor-pointer ${activeTab === 'settings'
                      ? 'bg-violet-500/12 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#222631]'
                      }`}
                  >
                    <Settings className="h-4 w-4" />
                    Control Room
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('users')}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition cursor-pointer ${activeTab === 'users'
                        ? 'bg-violet-500/12 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#222631]'
                        }`}
                    >
                      <Users className="h-4 w-4" />
                      Users
                    </button>
                  )}
                </nav>
              </aside>

              <section>
                {activeTab === 'general' && renderGeneralSection()}
                {activeTab === 'settings' && renderSettingsSection()}
                {activeTab === 'users' && isAdmin && renderUsersSection()}
              </section>
            </div>
          </>
        )}
      </main>

      <AnimatePresence>
        {themeToast && (
          <motion.div
            key={themeToast.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [40, -10, -150, -210],
              scale: [0.96, 1, 1, 0.98],
            }}
            transition={{
              duration: 3.2,
              times: [0, 0.12, 0.82, 1],
              ease: 'linear',
            }}
            className="pointer-events-none fixed bottom-8 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-violet-500/40 bg-white px-6 py-3.5 text-center text-sm font-semibold text-zinc-900 shadow-xl shadow-violet-600/15 sm:text-base dark:border-violet-400/40 dark:bg-[#191c24] dark:text-zinc-100 dark:shadow-violet-500/20"
          >
            {themeToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
