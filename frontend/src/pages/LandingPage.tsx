import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  EyeOff,
  Heart,
  Lock,
  MessageCircle,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api, type RegistrationStatusResponse } from '../lib/api';

const SAMPLE_POSTS = [
  {
    tag: 'Crush',
    tagColor: 'bg-rose-500/12 text-rose-500 dark:text-rose-400 border-rose-500/25',
    alias: 'Anon · Bhimtal',
    time: '9m',
    text: "i have a crush on someone from btech, don't know her name yet but i really liked her hair and vibe near the library today 👀",
    likes: 84,
    comments: 21,
  },
  {
    tag: 'Hackathon',
    tagColor: 'bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25',
    alias: 'Anon · Dehradun',
    time: '24m',
    text: 'need 1 backend + 1 UI person for this weekend’s hackathon, we already have the idea & deck ready—dm if free',
    likes: 31,
    comments: 11,
  },
  {
    tag: 'Class & Prof',
    tagColor: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25',
    alias: 'Anon · Haldwani',
    time: '52m',
    text: 'bro how strict is OS lab viva actually?? someone tell me before tomorrow morning pls 😭',
    likes: 47,
    comments: 19,
  },
  {
    tag: 'Hangout',
    tagColor: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    alias: 'Anon · Bhimtal',
    time: '1h',
    text: 'anyone down for chai + badminton at the court around 5:30? bored in hostel rn',
    likes: 18,
    comments: 7,
  },
];

const HOW_IT_WORKS = [
  {
    icon: ShieldCheck,
    title: 'College-verified only',
    desc: 'Every account is verified with a real campus email—no outsiders, no bots.',
  },
  {
    icon: EyeOff,
    title: 'Post without a name',
    desc: 'Share confessions, faculty takes, or event hype while your identity stays hidden.',
  },
  {
    icon: UserPlus,
    title: 'Anon DM until friends',
    desc: 'Chat privately with anyone anonymously; reveal handles only when both sides agree.',
  },
];

export function LandingPage() {
  const { user, isLoading } = useAuth();
  const [regStatus, setRegStatus] = useState<RegistrationStatusResponse | null>(null);

  useEffect(() => {
    api.getRegistrationStatus().then(setRegStatus).catch(() => { });
  }, []);

  if (!isLoading && user) {
    return <Navigate to={user.is_onboarded ? '/home' : '/onboarding'} replace />;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#eef1f6] text-zinc-900 dark:bg-[#111318] dark:text-zinc-100">
      <Navbar />

      {/* Balanced ambient motion glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.22, 0.32, 0.22] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-[130px] dark:bg-violet-600/25"
        />
        <motion.div
          animate={{ scale: [1.05, 0.95, 1.05], opacity: [0.14, 0.22, 0.14] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-1/4 h-[320px] w-[420px] rounded-full bg-indigo-400/20 blur-[120px]"
        />
      </div>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-12 sm:px-6 lg:pt-18">
        {/* Hero */}
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-6"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-300/80 bg-white/80 px-3.5 py-1 text-xs font-medium text-zinc-700 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-[#191c24]/90 dark:text-zinc-300">
              <span>Daily login limit:</span>
              {regStatus && (
                <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {regStatus.remaining_spots} spots left
                </span>
              )}
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl dark:text-white">
              Speak freely.{' '}
              <span className="bg-gradient-to-r from-violet-500 to-indigo-400 bg-clip-text text-transparent">
                Stay anonymous.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
              Your unfiltered campus space—post crushes, honest class takes, hackathon squads, and anonymous DMs without risking your name.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/signin"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300/90 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 shadow-xs transition hover:bg-zinc-100 dark:border-white/10 dark:bg-[#191c24] dark:text-zinc-200 dark:hover:bg-[#222631]"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-5 border-t border-zinc-300/70 pt-5 text-xs font-medium text-zinc-600 dark:border-white/10 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-violet-500" />
                Anon Posts &amp; Comments
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-violet-500" />
                Anon DMs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-violet-500" />
                Search by ID or Handle
              </span>
            </div>
          </motion.div>

          {/* Motion-Graphic Sample Posts */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:col-span-6">
            {SAMPLE_POSTS.map((post, idx) => (
              <motion.article
                key={post.tag}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#191c24]/90"
              >
                <div>
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${post.tagColor}`}>
                      {post.tag}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{post.time}</span>
                  </div>
                  <p className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">{post.text}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-200/70 pt-2.5 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <span className="font-medium">{post.alias}</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {post.likes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {post.comments}
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        {/* How Anonymity Works */}
        <section className="mt-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              How it stays uncompromised
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.08 }}
                  className="rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-xs dark:border-white/10 dark:bg-[#191c24]/80"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 text-violet-500">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="relative border-t border-zinc-300/70 bg-white/60 backdrop-blur-md dark:border-white/10 dark:bg-[#151821]/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:px-6 dark:text-zinc-400">
          <div className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
            <span>CampusConnect</span>
            <span className="text-zinc-400 dark:text-zinc-600">·</span>
            <span className="font-normal text-zinc-500 dark:text-zinc-400">The Unfiltered Side of Campus.</span>
          </div>

          <div className="flex items-center gap-5">
            <Link to="/signin" className="transition hover:text-zinc-900 dark:hover:text-zinc-200">
              Sign in
            </Link>
            <Link to="/signup" className="transition hover:text-zinc-900 dark:hover:text-zinc-200">
              Join
            </Link>
            <span className="text-zinc-400 dark:text-zinc-600">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
