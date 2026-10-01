// F3: an empty Project Overview and Product Files took ~420px between them,
// pushing the first ticket row off a laptop screen. These pin the folded layout.
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { renderToDom, flush } = await import('@/test/render');
const BoardInfo = (await import('./BoardInfo')).default;

/** Responds to the canvas and product-files requests with the given counts. */
const respond = (overview: unknown[], files: unknown[]) =>
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/canvas') ? overview : files })
  );

const show = async (isAdmin: boolean) => {
  const handle = renderToDom(<BoardInfo boardId="b1" isAdmin={isAdmin} />);
  await flush();
  return handle;
};

const project = { id: 'p1', name: 'Core', blocks: [] };
const file = { id: 'f1', title: 'PRD', url: 'https://example.com' };

describe('BoardInfo', () => {
  beforeEach(() => {
    get.mockReset();
    localStorage.clear();
  });

  it('folds both empty sections into one row of at most 48px', async () => {
    respond([], []);
    const { container, unmount } = await show(true);

    const row = container.querySelector('div.h-12');
    expect(row).not.toBeNull();
    expect(row?.className).toContain('h-12'); // Tailwind h-12 is 3rem / 48px
    expect(row?.textContent).toContain('Board info');
    expect(row?.textContent).toContain('Overview not set up');
    expect(row?.textContent).toContain('Files 0');
    expect(row?.textContent).toContain('Add');

    // The full sections are not taking up space.
    expect(container.querySelector('[hidden]')).not.toBeNull();
    unmount();
  });

  it('shows nothing at all to a non-admin with both sections empty', async () => {
    respond([], []);
    const { container, unmount } = await show(false);

    expect(container.textContent).toBe('');
    unmount();
  });

  it('keeps the sections expanded when either has content', async () => {
    respond([project], []);
    const { container, unmount } = await show(true);

    expect(container.querySelector('div.h-12')).toBeNull();
    expect(container.querySelector('[hidden]')).toBeNull();
    unmount();
  });

  it('keeps them expanded when only the files section has content', async () => {
    respond([], [file]);
    const { container, unmount } = await show(true);

    expect(container.querySelector('div.h-12')).toBeNull();
    expect(container.querySelector('[hidden]')).toBeNull();
    unmount();
  });

  it('remembers that board info was opened from the slim row', async () => {
    respond([], []);
    const first = await show(true);
    const add = Array.from(first.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add')
    );
    expect(add).toBeDefined();
    await act(() => add!.click());
    expect(first.container.querySelector('div.h-12')?.textContent).toContain('Hide board info');
    first.unmount();

    // A fresh mount for the same board reopens expanded.
    const second = await show(true);
    expect(second.container.textContent).toContain('Hide board info');
    second.unmount();
  });
});
