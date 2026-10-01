// Turns the rich-text HTML stored on a ticket into something safe to show in a
// card preview.
//
// Ticket descriptions are TipTap HTML strings. Rendering one straight into JSX
// prints the markup itself ("<p>KYB</p>"), which is what cards used to do. The
// text is recovered by parsing the HTML properly rather than stripping tags
// with a regex, so malformed or unexpected markup degrades to plain text
// instead of leaking angle brackets.

export type DescriptionPreview =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'checklist'; done: number; total: number };

// Blocks that should read as separate lines. `textContent` alone would run
// "<p>a</p><p>b</p>" together as "ab".
const BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th,figcaption';

// A tag-shaped run of text, e.g. "<p>" or "</li>". Used only to detect content
// that arrived double-escaped (`&lt;p&gt;`) so it can be parsed again — never
// to remove tags.
const LOOKS_LIKE_MARKUP = /<\/?[a-zA-Z][^<>]*>/;

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

function parseBody(html: string): HTMLElement | null {
  // Server-side there is no DOMParser. Board data is fetched in the browser, so
  // no card renders before hydration, but degrade to "no preview" rather than throw.
  if (typeof DOMParser === 'undefined') return null;
  return new DOMParser().parseFromString(html, 'text/html').body;
}

// Text of the innermost blocks only, so a task item (`li > div > p`) is counted
// once rather than once per ancestor.
function blockTexts(body: HTMLElement): string[] {
  const leaves = Array.from(body.querySelectorAll(BLOCK_SELECTOR)).filter(
    (el) => el.querySelector(BLOCK_SELECTOR) === null
  );

  if (leaves.length === 0) {
    const whole = collapse(body.textContent ?? '');
    return whole ? [whole] : [];
  }

  return leaves.map((el) => collapse(el.textContent ?? '')).filter(Boolean);
}

function read(html: string, depth: number): DescriptionPreview {
  const body = parseBody(html);
  if (!body) return { kind: 'empty' };

  // Checklists are summarised instead of quoted. `nested: true` on TaskItem
  // means items can be several levels deep, so every item counts.
  const items = Array.from(body.querySelectorAll('li[data-checked]'));
  if (items.length > 0) {
    const done = items.filter((li) => li.getAttribute('data-checked') === 'true').length;
    return { kind: 'checklist', done, total: items.length };
  }

  const text = blockTexts(body).join(' ');
  if (!text) return { kind: 'empty' };

  // Content saved double-escaped parses to text that is itself markup. Unwrap a
  // couple of layers so entities never reach the card.
  if (depth < 2 && LOOKS_LIKE_MARKUP.test(text)) return read(text, depth + 1);

  return { kind: 'text', text };
}

export function descriptionPreview(html: string | null | undefined): DescriptionPreview {
  if (!html || !html.trim()) return { kind: 'empty' };
  return read(html, 0);
}

/**
 * All the text in a description, checklist items included. Previews summarise a
 * checklist as a tally, but search should still match what the items say.
 */
export function descriptionText(html: string | null | undefined): string {
  if (!html || !html.trim()) return '';
  const body = parseBody(html);
  if (!body) return '';

  const text = blockTexts(body).join(' ');
  if (text && LOOKS_LIKE_MARKUP.test(text)) return descriptionText(text);
  return text;
}
