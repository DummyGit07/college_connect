import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { validateCollegeEmail } from '../lib/validation';

type Step = 1 | 2 | 3;

export function SignUpPage() {
  const navigate = useNavigate();
  const { user, isLoading, setSession } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!isLoading && user) {
    return <Navigate to={user.is_onboarded ? '/home' : '/onboarding'} replace />;
  }

  const emailCheck = validateCollegeEmail(email);
  const normalizedEmail = email.trim().toLowerCase();
  const passwordsValid = password.length >= 6 && password === confirmPassword;

  async function handleSendOtp(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!emailCheck.valid || submitting || cooldown > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.sendOtp(normalizedEmail);
      setCooldown(30);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send OTP.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (otp.trim().length !== 6 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.verifyOtp(normalizedEmail, otp.trim());
      setRegistrationToken(res.registration_token);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid verification code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault();
    if (!passwordsValid || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createAccount(normalizedEmail, password, registrationToken);
      await setSession(res.access_token);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-zinc-900 dark:bg-[#111318] dark:text-zinc-100">
      <Navbar />

      <main className="mx-auto flex max-w-sm flex-col justify-center px-4 py-16 sm:py-24">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#191c24]">
          {/* 3-step progress bar */}
          <div className="mb-6 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-white/10'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSendOtp}
                className="space-y-4"
              >
                <h1 className="text-2xl font-bold tracking-tight">Create account</h1>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="name.id@gehu.ac.in"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                  {email.trim().length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2" title={emailCheck.reason || 'Valid'}>
                      {emailCheck.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                      )}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!emailCheck.valid || submitting || cooldown > 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {cooldown > 0 ? `Wait ${cooldown}s` : 'Send OTP'}
                </button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleVerifyOtp}
                className="space-y-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {normalizedEmail}
                </button>

                <h1 className="text-2xl font-bold tracking-tight">Enter OTP</h1>

                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-center text-lg font-bold tracking-[0.4em] outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={otp.length !== 6 || submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    disabled={cooldown > 0 || submitting}
                    onClick={() => handleSendOtp()}
                    className="text-xs font-medium text-violet-500 hover:text-violet-400 disabled:text-zinc-400 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </motion.form>
            )}

            {step === 3 && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreateAccount}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold tracking-tight">Set password</h1>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (6+ chars)"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-[#111318]"
                  />
                  {confirmPassword.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {password === confirmPassword ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                      )}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!passwordsValid || submitting}
                  className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Already verified?{' '}
            <Link to="/signin" className="font-semibold text-violet-500 hover:text-violet-400">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
