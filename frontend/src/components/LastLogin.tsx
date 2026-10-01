'use client';
import { formatDay, formatTimeAgo } from '@/lib/formatDate';

interface Props {
  value?: string | null;
  className?: string;
  /** Prefix the value, e.g. "Last login 3h ago" rather than just "3h ago". */
  labelled?: boolean;
}

// Last sign-in, shown on every profile and visible to the whole team.
// Relative while recent, then the date — the same rule comment timestamps use.
export default function LastLogin({ value, className = 'text-xs text-gray-600', labelled = false }: Props) {
  const relative = formatTimeAgo(value);
  const text = relative ?? formatDay(value);

  return (
    <span className={className} title={text ? `Last login: ${formatDay(value)}` : 'Has not signed in yet'}>
      {labelled && text ? 'Last login ' : ''}
      {text ?? (labelled ? 'Never signed in' : 'Never')}
    </span>
  );
}
