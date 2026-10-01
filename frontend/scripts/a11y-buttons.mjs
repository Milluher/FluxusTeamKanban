// Flags <button> elements that render only an icon or a bare symbol and have no
// accessible name, so a screen reader announces just "button".
//
// Usage: node scripts/a11y-buttons.mjs
// Exits 1 if any unnamed icon-only button is found.
//
// JSX attributes contain arrow functions, so the end of an opening tag cannot be
// found by searching for the next ">". This walks the tag tracking quote state
// and brace depth instead.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// Text that conveys nothing on its own.
const SYMBOLS = new Set(['×', 'x', '+', '⋯', '…', '→', '←', '↑', '↓', '·', '•', '✓', '✕', '-', '‹', '›']);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

/** End index of the opening tag that starts at `start`, honouring quotes and {}. */
function endOfOpeningTag(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth--; continue; }
    if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

/** Index just past the matching </button>. */
function endOfElement(src, afterOpen) {
  let depth = 1;
  let i = afterOpen;
  while (depth > 0) {
    const next = src.indexOf('<button', i + 1);
    const close = src.indexOf('</button>', i + 1);
    if (close === -1) return -1;
    if (next !== -1 && next < close) { depth++; i = next; } else { depth--; i = close; }
  }
  return i;
}

const findings = [];

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  let cursor = 0;

  while (true) {
    const start = src.indexOf('<button', cursor);
    if (start === -1) break;
    cursor = start + 1;

    const tagEnd = endOfOpeningTag(src, start);
    if (tagEnd === -1) continue;
    const openTag = src.slice(start, tagEnd + 1);
    if (openTag.trimEnd().endsWith('/>')) continue;

    const bodyEnd = endOfElement(src, tagEnd);
    if (bodyEnd === -1) continue;
    const body = src.slice(tagEnd + 1, bodyEnd);

    // Any {expression} in the body may render a label, so only literal text is
    // judged; a body with no literal text and no expression is icon-only.
    const literal = body.replace(/<[^>]*>/g, '').replace(/\{[\s\S]*?\}/g, '').trim();
    const hasExpression = /\{/.test(body);
    const meaningful = literal && ![...literal].every((ch) => SYMBOLS.has(ch) || /\s/.test(ch));

    if (meaningful) continue;
    if (!literal && hasExpression) continue; // label probably comes from the expression

    const named = /\saria-label[=\s]/.test(openTag) || /\saria-labelledby[=\s]/.test(openTag);
    if (named) continue;

    findings.push({
      file: relative(ROOT, file),
      line: src.slice(0, start).split('\n').length,
      symbol: literal || '(icon only)',
      title: /\stitle="([^"]*)"/.exec(openTag)?.[1] ?? null,
    });
  }
}

if (findings.length === 0) {
  console.log('No unnamed icon-only buttons.');
  process.exit(0);
}

console.log(`${findings.length} icon-only button(s) with no accessible name:\n`);
for (const f of findings) {
  const title = f.title ? `  (title="${f.title}" — a title is not a dependable accessible name)` : '';
  console.log(`  ${f.file}:${f.line}  ${f.symbol}${title}`);
}
process.exit(1);
