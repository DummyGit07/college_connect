import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef1f6] dark:bg-[#111318]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!user.is_onboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-zinc-900 dark:bg-[#111318] dark:text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#191c24]"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified {user.college_name || 'Campus'} Student
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              {user.full_name || `@${user.user_id}`}
            </h1>
            <p className="text-sm font-medium text-violet-500">@{user.user_id}</p>
          </div>

          {user.bio && (
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {user.bio}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
            {user.campus && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 dark:border-white/10 dark:bg-[#111318]">
                <MapPin className="h-3.5 w-3.5 text-violet-500" />
                {user.campus} Campus
              </span>
            )}
            {user.course && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 dark:border-white/10 dark:bg-[#111318]">
                <GraduationCap className="h-3.5 w-3.5 text-violet-500" />
                {user.course}
                {user.batch ? ` · ${user.batch}` : ''}
              </span>
            )}
          </div>

          <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-[#111318]/70">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-violet-500" />
              You&apos;re all set
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Anonymous posts, comments, student search, and private DMs will appear here once those backend APIs are added.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
