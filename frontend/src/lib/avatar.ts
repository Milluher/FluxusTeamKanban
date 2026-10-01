// Avatars are drawn from the person's name rather than fetched.
//
// Every avatar used to be a DiceBear "adventurer-neutral" cartoon on one of five
// pastel circles, requested from api.dicebear.com — so a board view fired a few
// dozen external image requests, and at small sizes teammates were hard to tell
// apart because the faces and backgrounds were so similar.

// Deep, muted, natural tones. Each one carries white text at 4.5:1 or better;
// scripts/contrast.mjs asserts them.
export const AVATAR_COLORS = [
  '#475569', // slate
  '#0f766e', // deep teal
  '#4338ca', // dusk
  '#9a3412', // clay
  '#3f6212', // moss
  '#86198f', // plum
  '#1d4ed8', // ocean
  '#78350f', // bark
] as const;

/**
 * Up to two initials: first and last word of the name. Falls back to the first
 * character, then to "?" for an empty name.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Stable colour for a name. The same person is the same colour on every screen
 * and in every session, which is the point — it is an identity cue, not decoration.
 */
export function avatarColor(name: string): string {
  const key = name.trim().toLowerCase();
  // djb2, enough for spreading a few dozen names across eight buckets.
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
