/**
 * Parse an ISO timestamp string, treating timezone-naive strings as UTC.
 */
function parseIsoDate(isoDate: string): Date {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoDate) ? isoDate : `${isoDate}Z`;
  return new Date(normalized);
}

/**
 * Format an ISO timestamp into a compact relative time string (e.g., "just now", "5m", "2h", "3d"),
 * falling back to an IST date label after 7 days.
 */
export function formatRelativeTime(isoDate: string): string {
  const timestamp = parseIsoDate(isoDate).getTime();
  if (Number.isNaN(timestamp)) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return new Date(timestamp).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO timestamp in IST (Asia/Kolkata) for tooltip display.
 */
export function formatIstDateTime(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })} IST`;
}

const TAG_COLOR_MAP: Record<string, string> = {
  crush: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  confession: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  hackathon: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  hangout: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  class: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400',
  events: 'bg-teal-500/12 text-teal-600 dark:text-teal-400',
  'lost-found': 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
};

const DEFAULT_TAG_COLOR =
  'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300';

/**
 * Return soft color-coded Tailwind classes for a feed tag pill.
 */
export function getTagBadgeClass(tag: string): string {
  return TAG_COLOR_MAP[tag] ?? DEFAULT_TAG_COLOR;
}

const CAMPUS_COLOR_MAP: Record<string, string> = {
  bhimtal:
    'bg-blue-500/12 text-blue-600 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25',
  dehradun:
    'bg-orange-500/12 text-orange-600 border-orange-500/20 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/25',
  haldwani:
    'bg-emerald-500/12 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25',
};

const DEFAULT_CAMPUS_COLOR =
  'bg-violet-500/12 text-violet-600 border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25';

/**
 * Return color-coded Tailwind classes for a campus badge (case-insensitive).
 */
export function getCampusBadgeClass(campus?: string | null): string {
  const key = campus?.trim().toLowerCase() ?? '';
  return CAMPUS_COLOR_MAP[key] ?? DEFAULT_CAMPUS_COLOR;
}
