import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-[#eef1f6]/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#111318]/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Campus<span className="text-violet-500">Connect</span>
          </span>
        </Link>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          {user ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300/80 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-[#191c24] dark:text-zinc-300 dark:hover:bg-[#222631] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          ) : (
            <>
              <Link
                to="/signin"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm shadow-violet-600/25 transition hover:brightness-110"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
