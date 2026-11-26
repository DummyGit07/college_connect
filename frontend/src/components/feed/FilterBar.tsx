import { ArrowBigDown, ArrowBigUp, Clock, EyeOff, Flame, MapPin } from 'lucide-react';
import { ALLOWED_TAGS, type PostSort } from '../../lib/api';
import { getTagBadgeClass } from './utils';

export interface FilterBarProps {
  sort: PostSort;
  onSortChange: (sort: PostSort) => void;
  campus: string;
  onCampusChange: (campus: string) => void;
  tag: string;
  onTagChange: (tag: string) => void;
  isAdmin?: boolean;
  hiddenOnly?: boolean;
  onHiddenOnlyChange?: (next: boolean) => void;
}

const SORT_OPTIONS: { value: PostSort; label: string; icon: typeof Clock }[] = [
  { value: 'latest', label: 'Latest', icon: Clock },
  { value: 'trending', label: 'Trending', icon: Flame },
  { value: 'most_liked', label: 'Most Liked', icon: ArrowBigUp },
  { value: 'most_disliked', label: 'Most Disliked', icon: ArrowBigDown },
];

const CAMPUSES = ['All', 'Bhimtal', 'Haldwani', 'Dehradun'] as const;

/**
 * Unified feed filter bar housing sort pills, campus selector, and scrollable tag chips.
 */
export function FilterBar({
  sort,
  onSortChange,
  campus,
  onCampusChange,
  tag,
  onTagChange,
  isAdmin = false,
  hiddenOnly = false,
  onHiddenOnlyChange,
}: FilterBarProps) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-zinc-200/90 bg-white p-3 dark:border-white/10 dark:bg-[#191c24]">
      {/* Row 1: Sort icon-pills + Campus select */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Sort posts">
          {SORT_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = sort === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onSortChange(value)}
                title={label}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/25'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 dark:bg-[#111318] dark:text-zinc-400 dark:hover:bg-[#222631]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {isAdmin && onHiddenOnlyChange && (
            <button
              type="button"
              onClick={() => onHiddenOnlyChange(!hiddenOnly)}
              aria-pressed={hiddenOnly}
              title="Show hidden posts only"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
                hiddenOnly
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300 dark:hover:bg-[#222631]'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>Hidden</span>
            </button>
          )}

          <label className="relative inline-flex items-center">
            <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <select
              aria-label="Filter by campus"
              value={campus}
              onChange={(e) => onCampusChange(e.target.value)}
              className="h-8 cursor-pointer appearance-none rounded-full border border-zinc-200 bg-zinc-50 pl-7 pr-6 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus:border-violet-500 dark:border-white/10 dark:bg-[#111318] dark:text-zinc-300 dark:hover:bg-[#222631] dark:focus:border-violet-500"
            >
              {CAMPUSES.map((item) => (
                <option key={item} value={item === 'All' ? '' : item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Row 2: Horizontal scrollable tag chips */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter by tag"
      >
        <button
          type="button"
          onClick={() => onTagChange('')}
          aria-pressed={tag === ''}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            tag === ''
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/25'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 dark:bg-[#111318] dark:text-zinc-400 dark:hover:bg-[#222631]'
          }`}
        >
          All
        </button>
        {ALLOWED_TAGS.map((item) => {
          const active = tag === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onTagChange(active ? '' : item)}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/25'
                  : `${getTagBadgeClass(item)} hover:opacity-85`
              }`}
            >
              #{item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
