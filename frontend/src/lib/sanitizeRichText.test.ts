import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from './sanitizeRichText';

/**
 * Two halves, and both matter equally.
 *
 * The first proves the hole is closed. The second proves it was closed without
 * quietly destroying people's existing descriptions — a sanitiser that eats
 * checklists or table widths would be its own kind of damage.
 */

describe('sanitizeRichText — what must not survive', () => {
  it('removes a script tag', () => {
    const out = sanitizeRichText('<p>Before</p><script>alert(1)</script><p>After</p>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('Before');
    expect(out).toContain('After');
  });

  it('removes an onerror handler but keeps the image', () => {
    const out = sanitizeRichText('<img src="x" onerror="alert(document.cookie)">');
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toContain('document.cookie');
    expect(out).toContain('<img');
  });

  it('removes every inline event handler, not just the famous ones', () => {
    for (const attr of ['onclick', 'onload', 'onmouseover', 'onfocus', 'onanimationstart']) {
      const out = sanitizeRichText(`<p ${attr}="steal()">text</p>`);
      expect(out.toLowerCase()).not.toContain(attr);
      expect(out).toContain('text');
    }
  });

  it('strips a javascript: link but keeps the words', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">Click me</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out).toContain('Click me');
  });

  it('drops tags the editor cannot produce', () => {
    for (const html of [
      '<iframe src="https://evil.example"></iframe>',
      '<object data="x"></object>',
      '<embed src="x">',
      '<form action="/steal"><input name="a"></form>',
      '<base href="https://evil.example">',
      '<meta http-equiv="refresh" content="0">',
    ]) {
      const out = sanitizeRichText(html);
      expect(out).not.toMatch(/<(iframe|object|embed|form|base|meta)/i);
    }
  });

  it('neutralises an svg payload', () => {
    const out = sanitizeRichText('<svg><animate onbegin="alert(1)" attributeName="x"></animate></svg>');
    expect(out.toLowerCase()).not.toContain('onbegin');
    expect(out).not.toMatch(/<svg/i);
  });

  it('keeps the text of something it removes, rather than deleting the sentence', () => {
    const out = sanitizeRichText('<p>Keep <marquee>this text</marquee> please</p>');
    expect(out).toContain('Keep');
    expect(out).toContain('this text');
    expect(out).toContain('please');
    expect(out).not.toMatch(/<marquee/i);
  });

  it('handles empty and missing input without throwing', () => {
    expect(sanitizeRichText('')).toBe('');
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText(undefined)).toBe('');
  });
});

describe('sanitizeRichText — what must survive', () => {
  it('keeps headings, paragraphs and the text marks', () => {
    const html =
      '<h1>H1</h1><h2>H2</h2><h3>H3</h3><p>Plain</p>' +
      '<p><strong>bold</strong> <em>italic</em> <s>struck</s> <code>code</code></p>' +
      '<blockquote><p>quoted</p></blockquote><pre><code>block</code></pre><hr>';
    const out = sanitizeRichText(html);
    for (const tag of ['h1', 'h2', 'h3', 'p', 'strong', 'em', 's', 'code', 'blockquote', 'pre', 'hr']) {
      expect(out).toMatch(new RegExp(`<${tag}`, 'i'));
    }
  });

  it('keeps bullet and numbered lists', () => {
    const out = sanitizeRichText('<ul><li>one</li></ul><ol><li>two</li></ol>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<ol>');
    expect(out).toContain('one');
    expect(out).toContain('two');
  });

  it('keeps an ordinary link and its href', () => {
    const out = sanitizeRichText('<a href="https://example.com/doc">the doc</a>');
    expect(out).toContain('https://example.com/doc');
    expect(out).toContain('the doc');
  });

  it('keeps a pasted image stored as a data URI', () => {
    const dataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const out = sanitizeRichText(`<img src="${dataUri}" alt="pasted">`);
    expect(out).toContain('data:image/png;base64,');
    expect(out).toContain('alt="pasted"');
  });

  it('keeps a remote image', () => {
    const out = sanitizeRichText('<img src="https://example.com/a.png" alt="a">');
    expect(out).toContain('https://example.com/a.png');
  });

  it('keeps a task list, with the attributes the preview and the stylesheet key off', () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-checked="true"><label><input type="checkbox" checked></label><div><p>Done</p></div></li>' +
      '<li data-checked="false"><label><input type="checkbox"></label><div><p>Not done</p></div></li>' +
      '</ul>';
    const out = sanitizeRichText(html);
    expect(out).toContain('data-type="taskList"');
    expect(out).toContain('data-checked="true"');
    expect(out).toContain('data-checked="false"');
    expect(out).toMatch(/<input/i);
    expect(out).toContain('Done');
    expect(out).toContain('Not done');
  });

  it('keeps a table, including the column sizing TipTap writes', () => {
    const html =
      '<table><colgroup><col style="width: 120px"></colgroup>' +
      '<tbody><tr><th colspan="2">Head</th></tr><tr><td colwidth="120">Cell</td></tr></tbody></table>';
    const out = sanitizeRichText(html);
    expect(out).toContain('<table');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('colwidth="120"');
    expect(out).toContain('Head');
    expect(out).toContain('Cell');
  });

  it('leaves an ordinary description byte-for-byte usable', () => {
    const html = '<p>Verify BVN before payout.</p><ul><li>Check the ledger</li></ul>';
    const out = sanitizeRichText(html);
    expect(out).toContain('Verify BVN before payout.');
    expect(out).toContain('Check the ledger');
  });
});
