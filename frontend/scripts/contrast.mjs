// Asserts the WCAG AA contrast of every colour pair changed for the UX review's
// F11, and prints the before/after ratios.
//
// Usage: node scripts/contrast.mjs
// Exits 1 if any "after" pair falls below its threshold.
//
// Ratios are computed from the colour values, so this is a regression check on
// the palette, not on what the browser finally paints. Pairs are listed with the
// background each colour actually sits on.

const AA_TEXT = 4.5; // normal-size text
const AA_LARGE = 3.0; // 24px+, or 18.66px+ bold

const channels = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

// White at some alpha over a solid backdrop, for the navy sprint banner.
const over = (hex, alpha, backdrop) => {
  const f = channels(hex);
  const b = channels(backdrop);
  return `#${f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
};

const luminance = (hex) => {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const NAVY = '#1a1f3c';

// [what, background, before, after, threshold]
const PAIRS = [
  // The three the review measured and named.
  ['Sprint tag (dashboard)', '#fff7ed', '#f97316', '#c2410c', AA_TEXT],
  ['Kanban tag (dashboard)', '#faf5ff', '#a855f7', '#7e22ce', AA_TEXT],
  ['Section label "MY BOARDS"', '#f7f8fa', '#9ca3af', '#6b7280', AA_TEXT],

  // The wider grey sweep.
  ['Body/meta text on white', '#ffffff', '#9ca3af', '#6b7280', AA_TEXT],
  ['Meta text on page bg', '#f7f8fa', '#9ca3af', '#6b7280', AA_TEXT],
  ['Text on board bg', '#f0f2f5', '#9ca3af', '#4b5563', AA_TEXT],
  ['Comment count pill', '#f3f4f6', '#9ca3af', '#4b5563', AA_TEXT],
  ['"Unassigned" on card', '#ffffff', '#d1d5db', '#6b7280', AA_TEXT],
  ['"No features listed."', '#ffffff', '#d1d5db', '#6b7280', AA_TEXT],
  ['Input placeholders', '#ffffff', '#9ca3af', '#6b7280', AA_TEXT],
  ['Board type description', '#fff7f5', '#9ca3af', '#6b7280', AA_TEXT],

  // Ticket card and modal pills.
  ['Epic pill', '#fffbeb', '#d97706', '#b45309', AA_TEXT],
  ['Flow pill', '#f0fdfa', '#0d9488', '#0f766e', AA_TEXT],
  ['Project pill', '#eef2ff', '#6366f1', '#4338ca', AA_TEXT],
  ['Type pill (design)', '#fdf2f8', '#db2777', '#be185d', AA_TEXT],
  ['Type pill (frontend)', '#f0fdf4', '#16a34a', '#15803d', AA_TEXT],
  ['Priority High', '#fff7ed', '#ea580c', '#c2410c', AA_TEXT],
  ['Priority Urgent', '#fef2f2', '#dc2626', '#b91c1c', AA_TEXT],
  ['Done column badge', '#ecfdf5', '#059669', '#047857', AA_TEXT],

  // Sprint status colours, including the hover states that invert to white text.
  ['Sprint Active label', '#f0f9ff', '#0ea5e9', '#0369a1', AA_TEXT],
  ['Sprint Completed label', '#f0fdf4', '#16a34a', '#15803d', AA_TEXT],
  ['Sprint action hover (white on fill)', '#0369a1', '#ffffff', '#ffffff', AA_TEXT],
  ['Sprint done hover (white on fill)', '#15803d', '#ffffff', '#ffffff', AA_TEXT],
  ['"Copied!" button (white on fill)', '#15803d', '#ffffff', '#ffffff', AA_TEXT],
  ['Set dates link', '#ffffff', '#0284c7', '#0369a1', AA_TEXT],

  // Destructive icon affordances, previously near-invisible.
  ['Row action icons', '#ffffff', '#d1d5db', '#6b7280', AA_LARGE],
  ['Delete icon hover', '#fef2f2', '#ef4444', '#b91c1c', AA_LARGE],

  // Sprint banner text on navy — already passing, asserted so it stays that way.
  ['Sprint dates on navy', NAVY, over('#ffffff', 0.5, NAVY), over('#ffffff', 0.75, NAVY), AA_TEXT],
  ['Inactive toggle on navy', NAVY, over('#ffffff', 0.65, NAVY), over('#ffffff', 0.65, NAVY), AA_TEXT],

  // Left unchanged because they already pass; here to catch regressions.
  ['Changelog "Added"', '#e8f6ee', '#0f7b46', '#0f7b46', AA_TEXT],
  ['Changelog "Changed"', '#e8eefc', '#1d4ed8', '#1d4ed8', AA_TEXT],
  ['To Do column badge', '#eff6ff', '#2563eb', '#2563eb', AA_TEXT],
  ['Review column badge', '#f5f3ff', '#7c3aed', '#7c3aed', AA_TEXT],
  ['In Progress column badge', '#fff7f5', '#c73009', '#c73009', AA_TEXT],
  ['Backlog column badge', '#f1f5f9', '#475569', '#475569', AA_TEXT],
  ['Priority Medium', '#fffbeb', '#b45309', '#b45309', AA_TEXT],
  ['Priority Low', '#f9fafb', '#6b7280', '#6b7280', AA_TEXT],
];

const fmt = (n) => `${n.toFixed(2)}:1`;
const pad = (s, n) => String(s).padEnd(n);

let failed = 0;
console.log(`${pad('element', 38)}${pad('background', 11)}${pad('before', 20)}${pad('after', 20)}needs`);
console.log('-'.repeat(99));

for (const [what, bg, before, after, threshold] of PAIRS) {
  const was = ratio(before, bg);
  const now = ratio(after, bg);
  const ok = now >= threshold;
  if (!ok) failed++;

  const wasNote = `${before} ${fmt(was)}${was >= threshold ? '' : ' x'}`;
  const nowNote = `${after} ${fmt(now)} ${ok ? 'ok' : 'FAIL'}`;
  console.log(`${pad(what, 38)}${pad(bg, 11)}${pad(wasNote, 20)}${pad(nowNote, 20)}${threshold.toFixed(1)}`);
}

// Known exception, deliberately left alone: brand red is below AA both as text on
// white and behind the white text of a primary button. Darkening it to #c73009
// (already the hover shade) would clear AA at 5.45:1, but it is the brand colour
// and changing it is not an accessibility decision to make unilaterally.
const brandOnWhite = ratio('#e8390e', '#ffffff');
const whiteOnBrand = ratio('#ffffff', '#e8390e');
console.log('\nNot changed — needs a brand decision:');
console.log(`  brand #e8390e text on white            ${fmt(brandOnWhite)}  below ${AA_TEXT}`);
console.log(`  white text on brand #e8390e fill       ${fmt(whiteOnBrand)}  below ${AA_TEXT}`);
console.log(`  proposed #c73009 (existing hover shade) ${fmt(ratio('#c73009', '#ffffff'))}  clears AA`);

if (failed > 0) {
  console.error(`\n${failed} pair(s) below threshold.`);
  process.exit(1);
}
console.log(`\nAll ${PAIRS.length} changed pairs meet their threshold.`);
