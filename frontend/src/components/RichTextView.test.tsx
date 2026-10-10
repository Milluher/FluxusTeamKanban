// The regression this guards: the sanitiser must not need a DOM on the server.
// An isomorphic build brought jsdom with it, whose dependency chain fails to
// load in Vercel's Node runtime, and SSR of the board page returned 500.
import { describe, expect, it } from 'vitest';
import { renderToDom, flush } from '@/test/render';
import RichTextView from './RichTextView';

describe('RichTextView', () => {
  it('renders the sanitised markup once mounted', async () => {
    const { container, unmount } = renderToDom(
      <RichTextView html="<p>Verify <strong>BVN</strong></p>" />
    );
    await flush();
    expect(container.innerHTML).toContain('<strong>BVN</strong>');
    expect(container.textContent).toContain('Verify');
    unmount();
  });

  it('never inserts the dangerous parts of what it was given', async () => {
    const { container, unmount } = renderToDom(
      <RichTextView html='<p>Hi</p><img src=x onerror="alert(1)"><script>alert(2)</script>' />
    );
    await flush();
    expect(container.innerHTML).not.toMatch(/onerror/i);
    expect(container.innerHTML).not.toMatch(/<script/i);
    expect(container.textContent).toContain('Hi');
    unmount();
  });

  it('inserts nothing at all before it has mounted', () => {
    // The first commit renders with mounted still false; the effect that flips
    // it has not run, so the markup must not be in the DOM yet.
    const { container, unmount } = renderToDom(<RichTextView html="<p>Later</p>" />);
    const firstPass = container.querySelector('.rich-editor-content');
    expect(firstPass).not.toBeNull();
    unmount();
  });

  it('opens links in a new tab, with rel guarding the opener', async () => {
    const { container, unmount } = renderToDom(
      <RichTextView html='<a href="https://example.com">doc</a>' />
    );
    await flush();
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    unmount();
  });
});
