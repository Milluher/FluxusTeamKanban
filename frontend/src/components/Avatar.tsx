'use client';

interface Props {
  name: string;
  /** Tailwind box and text classes, e.g. "w-8 h-8 text-xs". */
  className?: string;
  /** An uploaded photo, if the app ever has them. Falls back to initials. */
  src?: string | null;
  /** Dim and desaturate, for someone who is not currently active. */
  inactive?: boolean;
  /** Set when a neighbouring element already says the name. */
  decorative?: boolean;
}

import { avatarColor, initials } from '@/lib/avatar';

// Initials on a colour derived from the name. The full name is in a title so it
// is available on hover and on focus, which is what tells two teammates apart at
// 20px.
export default function Avatar({ name, className = 'w-8 h-8 text-xs', src, inactive = false, decorative = false }: Props) {
  const label = decorative ? undefined : name;

  if (src) {
    return (
      <img
        src={src}
        alt={decorative ? '' : name}
        title={label}
        className={`${className} rounded-full flex-shrink-0 object-cover ${inactive ? 'grayscale opacity-60' : ''}`}
      />
    );
  }

  return (
    <span
      // tabIndex 0 would put every avatar in the tab order; focus reaches the
      // control that wraps it instead, and the title shows with it.
      title={label}
      aria-hidden={decorative || undefined}
      aria-label={label}
      role={decorative ? undefined : 'img'}
      className={`${className} rounded-full flex-shrink-0 inline-flex items-center justify-center font-semibold text-white select-none ${inactive ? 'grayscale opacity-60' : ''}`}
      style={{ background: avatarColor(name), letterSpacing: '0.02em' }}
    >
      {initials(name)}
    </span>
  );
}
