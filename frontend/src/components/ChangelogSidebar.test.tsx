import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangelogEntry, User } from '@/types';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, patch, post, delete: del } }));

const { renderToDom, flush } = await import('@/test/render');
const { act } = await import('react');
const ChangelogSidebar = (await import('./ChangelogSidebar')).default;

const admin: User = { id: 'u1', name: 'Femi A', email: 'f@f.com', role: 'admin' } as User;
const member: User = { id: 'u2', name: 'Alice Doe', email: 'a@f.com', role: 'standard' } as User;

const entry = (over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  id: 'e1',
  version: 'v1.4',
  title: 'Backlog scheduling',
  summary: 'Tickets now start in the backlog.',
  items: [
    { kind: 'added', text: 'Schedule a backlog ticket into a sprint' },
    { kind: 'fixed', text: 'Clean shutdown on deploy' },
  ],
  boardId: 'b1',
  board: { id: 'b1', name: 'Roadmap' },
  author: { id: 'u1', name: 'Femi A' },
  publishedAt: '2026-11-14T00:00:00.000Z',
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
  restricted: false,
  itemCount: 2,
  ...over,
});

interface OpenOpts {
  user?: User;
  entries?: ChangelogEntry[];
  /** Open it outside a board, where it lists every project. */
  allProjects?: boolean;
}

// `boardId` is read rather than destructured with a default: passing
// `boardId: undefined` to a defaulted parameter would quietly get the default
// back, which is the opposite of what the "all projects" case is testing.
const open = (opts: OpenOpts = {}) => {
  const user = opts.user ?? admin;
  const boardId = opts.allProjects ? undefined : 'b1';
  const entries = opts.entries ?? [entry()];
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/changelog' ? entries : [] })
  );
  const onClose = vi.fn();
  const handle = renderToDom(<ChangelogSidebar user={user} boardId={boardId} onClose={onClose} />);
  return { ...handle, onClose };
};

const button = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

const expand = async (container: HTMLElement, title: string) => {
  const toggle = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(title)
  )!;
  await act(async () => { toggle.click(); });
  await flush();
};

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
  del.mockReset();
});

describe('ChangelogSidebar', () => {
  it('opens beside the page rather than replacing it', async () => {
    // "Did that already ship?" is asked while looking at the work, so the
    // answer must not cost you the board or the sprint.
    const { container, unmount } = open();
    await flush();
    const panel = container.querySelector('aside[aria-label="Changelog"]')!;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain('fixed');
    expect(panel.className).toContain('right-0');
    unmount();
  });

  it('scopes to the board it is opened on', async () => {
    const { unmount } = open();
    await flush();
    expect(get).toHaveBeenCalledWith('/changelog', { params: { boardId: 'b1' } });
    unmount();
  });

  it('shows every project it can see when opened outside a board', async () => {
    const { container, unmount } = open({ allProjects: true });
    await flush();
    const call = get.mock.calls.find((c) => c[0] === '/changelog')!;
    expect(call[1]?.params).toBeUndefined();
    expect(container.textContent).toContain('All projects');
    unmount();
  });

  it('lists titles collapsed, with the detail only when one is opened', async () => {
    const { container, unmount } = open();
    await flush();
    expect(container.textContent).toContain('Backlog scheduling');
    expect(container.textContent).toContain('v1.4');
    expect(container.textContent).not.toContain('Schedule a backlog ticket');

    await expand(container, 'Backlog scheduling');
    expect(container.textContent).toContain('Tickets now start in the backlog.');
    expect(container.textContent).toContain('Schedule a backlog ticket');
    unmount();
  });

  it('groups the items by kind', async () => {
    const { container, unmount } = open();
    await flush();
    await expand(container, 'Backlog scheduling');
    expect(container.textContent).toContain('Added');
    expect(container.textContent).toContain('Fixed');
    expect(container.textContent).not.toContain('Removed');
    unmount();
  });

  it('marks a draft', async () => {
    const { container, unmount } = open({ entries: [entry({ publishedAt: null })] });
    await flush();
    expect(container.textContent).toContain('Draft');
    unmount();
  });

  it('says why a restricted entry has no detail, rather than looking empty', async () => {
    // An entry is listed for anyone who can see its project but spelled out
    // only for its members.
    const { container, unmount } = open({
      user: member,
      entries: [entry({ restricted: true, items: [], summary: null, itemCount: 3 })],
    });
    await flush();
    await expand(container, 'Backlog scheduling');
    expect(container.textContent).toContain('3 updates');
    expect(container.textContent).toContain('members');
    unmount();
  });

  it('keeps writing and deleting to admins', async () => {
    const { container, unmount } = open({ user: member });
    await flush();
    expect(button(container, '+ New entry')).toBeUndefined();
    expect(container.querySelector('[aria-label^="Actions for"]')).toBeNull();
    unmount();
  });

  it('offers an admin the editor, seeded with the project in view', async () => {
    const { container, unmount } = open();
    await flush();
    expect(button(container, '+ New entry')).toBeDefined();
    expect(get).toHaveBeenCalledWith('/boards');
    unmount();
  });

  it('deletes an entry once confirmed', async () => {
    del.mockResolvedValue({ data: {} });
    const { container, unmount } = open();
    await flush();
    await expand(container, 'Backlog scheduling');
    // The confirm lives inside the expanded entry; drive it through the menu.
    const menu = container.querySelector('[aria-label^="Actions for"]') as HTMLButtonElement;
    await act(async () => { menu.click(); });
    const remove = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Delete')
    ) as HTMLElement;
    await act(async () => { remove.click(); });
    await flush();
    expect(container.textContent).toContain('It goes for everyone');

    await act(async () => { button(container, 'Delete')!.click(); });
    await flush();
    expect(del).toHaveBeenCalledWith('/changelog/e1');
    unmount();
  });

  it('reports a failed delete rather than looking as though it worked', async () => {
    del.mockRejectedValue({ response: { data: { error: 'Not allowed' } } });
    const { container, unmount } = open();
    await flush();
    await expand(container, 'Backlog scheduling');
    const menu = container.querySelector('[aria-label^="Actions for"]') as HTMLButtonElement;
    await act(async () => { menu.click(); });
    const remove = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Delete')
    ) as HTMLElement;
    await act(async () => { remove.click(); });
    await act(async () => { button(container, 'Delete')!.click(); });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Not allowed');
    unmount();
  });

  it('tells an admin what the changelog is for when it is empty', async () => {
    const { container, unmount } = open({ entries: [] });
    await flush();
    expect(container.textContent).toContain('Nothing released yet');
    expect(container.textContent).toContain('did that go out');
    unmount();
  });

  it('tells a member to wait rather than to write one', async () => {
    const { container, unmount } = open({ user: member, entries: [] });
    await flush();
    expect(container.textContent).toContain('once an admin writes them');
    unmount();
  });

  it('closes on Escape', async () => {
    const { onClose, unmount } = open();
    await flush();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('leaves Escape to the editor while it is open', async () => {
    // Otherwise one key would close the panel out from under a half-written
    // entry, losing every item typed into it.
    const { container, onClose, unmount } = open();
    await flush();
    await act(async () => { button(container, '+ New entry')!.click(); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });
});
