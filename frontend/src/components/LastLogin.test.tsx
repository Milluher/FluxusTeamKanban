import { describe, expect, it } from 'vitest';
import { renderToHtml } from '@/test/render';
import LastLogin from './LastLogin';

describe('LastLogin', () => {
  it('is relative while recent', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(renderToHtml(<LastLogin value={threeHoursAgo} />)).toContain('3h ago');
  });

  it('falls back to a date once it is not recent', () => {
    expect(renderToHtml(<LastLogin value="2026-05-15T09:00:00.000Z" />)).toContain('15 May 2026');
  });

  it('says so when someone has never signed in', () => {
    expect(renderToHtml(<LastLogin value={null} />)).toContain('Never');
    expect(renderToHtml(<LastLogin value={undefined} labelled />)).toContain('Never signed in');
  });

  it('labels the value when asked', () => {
    const html = renderToHtml(<LastLogin value={new Date().toISOString()} labelled />);
    expect(html).toContain('Last login');
  });

  it('carries the full date in a title, since the relative form loses it', () => {
    const html = renderToHtml(<LastLogin value="2026-05-15T09:00:00.000Z" />);
    expect(html).toContain('title="Last login: 15 May 2026"');
  });
});
