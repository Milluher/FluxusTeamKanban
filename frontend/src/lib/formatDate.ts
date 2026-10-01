// One date format for the whole app: "15 May 2026" — unambiguous in both the UK
// and Nigeria, unlike 15/05/2026 vs 05/15/2026.

// Sprint dates are calendar days, not instants. Prisma returns them as UTC
// midnight ISO strings, so parsing with `new Date()` and reading local getters
// shifts the day backwards west of UTC. Read the date parts directly instead.
function toLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Written out rather than taken from toLocaleDateString: en-GB abbreviates
// September as "Sept", which is both wider than every other month and dependent
// on the runtime's ICU version. A fixed table keeps the format identical
// everywhere and makes the output testable.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Whole days between two dates. Rounded so a DST change (a 23- or 25-hour day)
// doesn't turn into a fractional day.
const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

/** "15 May 2026", or null when there is no usable date. */
export function formatDay(value: string | Date | null | undefined): string | null {
  const date = toLocalDate(value);
  if (!date) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Compact range: "12–26 Oct" within one month, "28 Sep – 12 Oct" across months,
 * and years only when they differ from each other or from today.
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  const from = toLocalDate(start);
  const to = toLocalDate(end);

  if (!from && !to) return null;
  if (from && !to) return `From ${formatDay(from)}`;
  if (!from && to) return `Until ${formatDay(to)}`;

  const a = from as Date;
  const b = to as Date;
  const sameYear = a.getFullYear() === b.getFullYear();
  const showYear = !sameYear || a.getFullYear() !== now.getFullYear();
  const month = (d: Date) => MONTHS[d.getMonth()];

  if (sameYear && a.getMonth() === b.getMonth()) {
    const year = showYear ? ` ${a.getFullYear()}` : '';
    return a.getDate() === b.getDate()
      ? `${a.getDate()} ${month(a)}${year}`
      : `${a.getDate()}–${b.getDate()} ${month(a)}${year}`;
  }

  const side = (d: Date) => `${d.getDate()} ${month(d)}${showYear ? ` ${d.getFullYear()}` : ''}`;
  return `${side(a)} – ${side(b)}`;
}

/**
 * Where the sprint sits relative to today: "4 days left", "Ends today",
 * "Ended 3 days ago", or "Starts in 2 days" before it begins.
 */
export function formatSprintTiming(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  const from = toLocalDate(start);
  const to = toLocalDate(end);

  if (from) {
    const untilStart = daysBetween(now, from);
    if (untilStart === 1) return 'Starts tomorrow';
    if (untilStart > 1) return `Starts in ${untilStart} days`;
  }

  if (!to) return null;

  const untilEnd = daysBetween(now, to);
  if (untilEnd === 0) return 'Ends today';
  if (untilEnd === 1) return '1 day left';
  if (untilEnd > 1) return `${untilEnd} days left`;
  if (untilEnd === -1) return 'Ended yesterday';
  return `Ended ${Math.abs(untilEnd)} days ago`;
}

/** The full sprint line: "12–26 Oct · 4 days left". Null when no dates are set. */
export function formatSprintDates(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  const range = formatDateRange(start, end, now);
  if (!range) return null;
  const timing = formatSprintTiming(start, end, now);
  return timing ? `${range} · ${timing}` : range;
}
