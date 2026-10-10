import DOMPurify, { type Config } from 'dompurify';

/**
 * Sanitises stored rich text before it is put into the DOM.
 *
 * Ticket descriptions are stored as HTML and rendered with
 * dangerouslySetInnerHTML, and the API accepts any string as a description.
 * Without this, one person could store `<img src=x onerror=…>` in a ticket and
 * have it run in the browser of every teammate who opened it.
 *
 * Sanitising at render rather than only at write is deliberate: it protects
 * content that is *already* stored, which a write-side filter alone would not.
 *
 * Browser-only on purpose. The isomorphic build of DOMPurify brings jsdom with
 * it, and jsdom's dependency chain fails to load in Vercel's Node runtime
 * (ERR_REQUIRE_ESM out of html-encoding-sniffer) — which took the whole board
 * page down with a 500 before this was split out. The content this guards only
 * ever arrives from a client-side fetch, so there is nothing to sanitise during
 * a server render; the caller renders nothing until it is mounted.
 *
 * The allowlist is deny-by-default and derived from what the editor can
 * actually produce: TipTap StarterKit, plus Table, TaskList/TaskItem and Image.
 * Anything the editor cannot produce has no business rendering.
 */

/** Tags the editor produces. Everything else is dropped. */
const ALLOWED_TAGS = [
  // StarterKit blocks and marks
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'hr',
  'ul', 'ol', 'li', 'a', 'span', 'div',
  // Image extension
  'img',
  // Table extension
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
  // TaskList / TaskItem render a label and a checkbox per item
  'label', 'input',
];

/**
 * Attributes the editor needs.
 *
 * `data-type` and `data-checked` carry TipTap's task lists, which the card
 * preview and the stylesheet both key off — dropping them would turn every
 * checklist into a plain bullet list.
 *
 * `style` is allowed because TipTap sizes table columns with it; DOMPurify
 * parses and filters the CSS inside it rather than passing it through.
 */
const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height',
  'colspan', 'rowspan', 'colwidth', 'style',
  'type', 'checked', 'disabled',
  'data-type', 'data-checked',
  'class',
];

const CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Pasted and uploaded images are stored inline as data: URIs, so img has to
  // keep them. Scoped to img alone: a data: URI anywhere else is not something
  // the editor produces.
  ADD_DATA_URI_TAGS: ['img'],
  // Keep the text of anything dropped, so removing a stray tag does not
  // silently delete a sentence.
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * The stored HTML, with anything the editor could not have produced removed.
 *
 * Returns an empty string where DOMPurify cannot run. That matters: without a
 * DOM, DOMPurify reports `isSupported: false` and `sanitize` hands the input
 * straight back — so trusting its return value outside a browser would quietly
 * reintroduce exactly the hole this closes.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return '';
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}
