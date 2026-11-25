import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';

const CAMPUSES = ['Bhimtal', 'Haldwani', 'Dehradun'] as const;

const GEHU_COURSES = [
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

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isLoading, refreshUser } = useAuth();

  const [userId, setUserId] = useState('');
  const [campus, setCampus] = useState('');
  const [course, setCourse] = useState('');
  const [batch, setBatch] = useState('');
  const [bio, setBio] = useState('');

  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanHandle = userId.trim().toLowerCase();

  useEffect(() => {
    if (cleanHandle.length < 3) {
      setHandleAvailable(null);
      setCheckingHandle(false);
      return;
    }

    setCheckingHandle(true);
    const timer = setTimeout(() => {
      api
        .checkUserId(cleanHandle)
        .then((res) => setHandleAvailable(res.is_available))
        .catch(() => setHandleAvailable(null))
        .finally(() => setCheckingHandle(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [cleanHandle]);

  if (!isLoading && !user) {
    return <Navigate to="/signin" replace />;
  }

  if (!isLoading && user?.is_onboarded) {
    return <Navigate to="/home" replace />;
  }

  const canSubmit =
    cleanHandle.length >= 3 &&
    cleanHandle.length <= 30 &&
    handleAvailable !== false &&
    campus.length > 0 &&
    !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.submitOnboarding({
        user_id: cleanHandle,
        campus,
        course: course || null,
        batch: batch.trim() || null,
        bio: bio.trim() || null,
      });
      await refreshUser();
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save onboarding details.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-zinc-900 dark:bg-[#111318] dark:text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#191c24]"
        >
          <h1 className="text-2xl font-bold tracking-tight">Set up your handle</h1>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Compulsory: Handle */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Handle <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  @
                </span>
                <input
                  type="text"
                  maxLength={30}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/\s+/g, ''))}
                  placeholder="vinod07"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-8 pr-10 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingHandle && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                  {!checkingHandle && handleAvailable === true && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {!checkingHandle && handleAvailable === false && (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                </div>
              </div>
              {!checkingHandle && handleAvailable === false && (
                <p className="mt-1 text-xs text-rose-500">Handle already taken.</p>
              )}
            </div>

            {/* Compulsory: Campus */}
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Campus <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {CAMPUSES.map((c) => {
                  const active = campus === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCampus(c)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition cursor-pointer ${active
                          ? 'border-violet-500 bg-violet-600/15 text-violet-600 dark:text-violet-300'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300 dark:hover:border-white/20'
                        }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional: Course & Batch */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Course
                </label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                >
                  <option value="">Optional</option>
                  {GEHU_COURSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Batch
                </label>
                <input
                  type="text"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="2022-2026"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                />
              </div>
            </div>

            {/* Optional: Bio */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Bio</span>
                <span>{bio.length}/160</span>
              </div>
              <textarea
                rows={2}
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Optional short bio..."
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
