import { describe, expect, it } from 'vitest';
import { descriptionPreview } from './richText';

describe('descriptionPreview', () => {
  it('reads a paragraph as plain text', () => {
    expect(descriptionPreview('<p>KYB</p>')).toEqual({ kind: 'text', text: 'KYB' });
  });

  it('separates block elements instead of running them together', () => {
    expect(descriptionPreview('<p>Verify BVN</p><p>Then KYB</p>')).toEqual({
      kind: 'text',
      text: 'Verify BVN Then KYB',
    });
  });

  it('counts a nested task list with mixed checked states', () => {
    const html = `
      <ul data-type="taskList">
        <li data-checked="true"><label><input type="checkbox" checked></label><div><p>Design</p></div></li>
        <li data-checked="false"><label><input type="checkbox"></label><div><p>Build</p>
          <ul data-type="taskList">
            <li data-checked="true"><label><input type="checkbox" checked></label><div><p>API</p></div></li>
            <li data-checked="false"><label><input type="checkbox"></label><div><p>UI</p></div></li>
          </ul>
        </div></li>
      </ul>`;
    expect(descriptionPreview(html)).toEqual({ kind: 'checklist', done: 2, total: 4 });
  });

  it('summarises a flat checklist rather than quoting its text', () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-checked="false"><label><input type="checkbox"></label><div><p>One</p></div></li>' +
      '<li data-checked="true"><label><input type="checkbox" checked></label><div><p>Two</p></div></li>' +
      '</ul>';
    expect(descriptionPreview(html)).toEqual({ kind: 'checklist', done: 1, total: 2 });
  });

  it('treats empty and whitespace-only content as empty', () => {
    expect(descriptionPreview('')).toEqual({ kind: 'empty' });
    expect(descriptionPreview(null)).toEqual({ kind: 'empty' });
    expect(descriptionPreview(undefined)).toEqual({ kind: 'empty' });
    expect(descriptionPreview('<p></p>')).toEqual({ kind: 'empty' });
    expect(descriptionPreview('<p>   </p><p><br></p>')).toEqual({ kind: 'empty' });
  });

  it('recovers text from malformed html without leaking tags', () => {
    expect(descriptionPreview('<p>Unclosed <b>bold')).toEqual({ kind: 'text', text: 'Unclosed bold' });
    expect(descriptionPreview('<ul data-type="taskList"><li data-checked="false"><div><p>Half')).toEqual({
      kind: 'checklist',
      done: 0,
      total: 1,
    });
    expect(descriptionPreview('plain text, no tags at all')).toEqual({
      kind: 'text',
      text: 'plain text, no tags at all',
    });
  });

  it('never leaves markup or entities in the extracted text', () => {
    // Content saved double-escaped: the first parse yields text that is markup.
    const preview = descriptionPreview('&lt;p&gt;Escaped&lt;/p&gt;');
    expect(preview).toEqual({ kind: 'text', text: 'Escaped' });

    for (const html of [
      '<p>KYB</p>',
      '<p>Unclosed <b>bold',
      '&lt;p&gt;Escaped&lt;/p&gt;',
      '<h2>Heading</h2><ul><li>Item</li></ul>',
      '<p>a &amp; b &lt; c</p>',
    ]) {
      const result = descriptionPreview(html);
      if (result.kind === 'text') {
        expect(result.text).not.toMatch(/<\/?[a-zA-Z]/);
        expect(result.text).not.toMatch(/&(lt|gt|amp|quot|#\d+);/);
      }
    }
  });

  it('keeps an image-only description out of the preview', () => {
    expect(descriptionPreview('<p><img src="x.png"></p>')).toEqual({ kind: 'empty' });
  });
});
