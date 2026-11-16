import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Initiative, User } from '@/types';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, patch, post, delete: del } }));

const { renderToDom, flush } = await import('@/test/render');
const { act } = await import('react');
const InitiativesSidebar = (await import('./InitiativesSidebar')).default;

const admin: User = { id: 'u1', name: 'Femi A', email: 'f@f.com', role: 'admin' } as User;
const author: User = { id: 'u2', name: 'Alice Doe', email: 'a@f.com', role: 'standard' } as User;
const other: User = { id: 'u3', name: 'Bob Roe', email: 'b@f.com', role: 'standard' } as User;

const initiative = (over: Partial<Initiative> = {}): Initiative => ({
  id: 'i1',
  title: 'Cut onboarding to one day',
  description: 'Right now it takes a week of back and forth.',
  status: 'in_progress',
  boardId: 'b1',
  board: { id: 'b1', name: 'Roadmap' },
  createdById: author.id,
  createdBy: { id: author.id, name: author.name },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  tickets: [],
  ...over,
});

interface OpenOpts {
  user?: User;
  initiatives?: Initiative[];
  /** Open it outside a board, where it lists every board's. */
  allBoards?: boolean;
}

// `boardId` is read rather than destructured with a default: passing
// `boardId: undefined` to a defaulted parameter would quietly get the default
// back, which is the opposite of what the "all boards" case is testing.
const open = (opts: OpenOpts = {}) => {
  const user = opts.user ?? admin;
  const boardId = opts.allBoards ? undefined : 'b1';
  get.mockResolvedValue({ data: opts.initiatives ?? [initiative()] });
  const onClose = vi.fn();
  const handle = renderToDom(<InitiativesSidebar user={user} boardId={boardId} onClose={onClose} />);
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

describe('InitiativesSidebar', () => {
  it('opens beside the page rather than replacing it', async () => {
    // The whole point: an initiative explains the tickets on the board behind
    // it, so reading one must not cost you the board or the sprint.
    const { container, unmount } = open();
    await flush();
    const panel = container.querySelector('aside[aria-label="Initiatives"]')!;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain('fixed');
    expect(panel.className).toContain('right-0');
    unmount();
  });

  it('scopes to the board it is opened on', async () => {
    const { unmount } = open();
    await flush();
    expect(get).toHaveBeenCalledWith('/initiatives', { params: { boardId: 'b1' } });
    unmount();
  });

  it('shows every board it can see when opened outside one', async () => {
    const { container, unmount } = open({ allBoards: true });
    await flush();
    expect(get.mock.calls[0][0]).toBe('/initiatives');
    expect(get.mock.calls[0][1]?.params).toBeUndefined();
    expect(container.textContent).toContain('All boards');
    unmount();
  });

  it('lists titles collapsed, and the detail only when one is opened', async () => {
    // For checking an initiative mid-task, not for reading all of them at once.
    const { container, unmount } = open();
    await flush();
    expect(container.textContent).toContain('Cut onboarding to one day');
    expect(container.textContent).not.toContain('back and forth');

    await expand(container, 'Cut onboarding to one day');
    expect(container.textContent).toContain('back and forth');
    unmount();
  });

  it('lists the tickets raised to fulfil it', async () => {
    const { container, unmount } = open({
      initiatives: [
        initiative({
          tickets: [
            { id: 't1', title: 'Import from CSV', status: 'To Do', column: { board: { id: 'b1', name: 'Roadmap' } } },
          ],
        }),
      ],
    });
    await flush();
    await expand(container, 'Cut onboarding to one day');
    expect(container.textContent).toContain('Import from CSV');
    expect(container.textContent).toContain('1 ticket');
    unmount();
  });

  it('flags a ticket that lives on another board', async () => {
    const { container, unmount } = open({
      initiatives: [
        initiative({
          tickets: [
            { id: 't1', title: 'Shared work', status: 'To Do', column: { board: { id: 'b9', name: 'Payments' } } },
          ],
        }),
      ],
    });
    await flush();
    await expand(container, 'Cut onboarding to one day');
    expect(container.textContent).toContain('Payments');
    unmount();
  });

  it('points at the ticket field when an initiative has no tickets', async () => {
    const { container, unmount } = open();
    await flush();
    await expand(container, 'Cut onboarding to one day');
    expect(container.textContent).toContain('Set the Initiative field on a ticket');
    unmount();
  });

  it('lets the author change the status', async () => {
    patch.mockResolvedValue({ data: initiative({ status: 'achieved' }) });
    const { container, unmount } = open({ user: author });
    await flush();
    await expand(container, 'Cut onboarding to one day');
    await act(async () => { button(container, 'Achieved')!.click(); });
    await flush();
    expect(patch).toHaveBeenCalledWith('/initiatives/i1', { status: 'achieved' });
    unmount();
  });

  it('shows an initiative somebody else owns read-only', async () => {
    const { container, unmount } = open({ user: other });
    await flush();
    await expand(container, 'Cut onboarding to one day');
    // The status is stated, but not as a control they can press.
    expect(container.textContent).toContain('In Progress');
    expect(button(container, 'Achieved')).toBeUndefined();
    expect(container.querySelector('[aria-label^="Actions for"]')).toBeNull();
    unmount();
  });

  it('says what an initiative is when there are none', async () => {
    // "Initiative" is used loosely, so the empty state defines it.
    const { container, unmount } = open({ initiatives: [] });
    await flush();
    expect(container.textContent).toContain('No initiatives yet');
    expect(container.textContent).toContain('strategic goal');
    unmount();
  });

  it('reports a failed status change rather than looking unchanged', async () => {
    patch.mockRejectedValue({ response: { data: { error: 'Not yours to change' } } });
    const { container, unmount } = open({ user: author });
    await flush();
    await expand(container, 'Cut onboarding to one day');
    await act(async () => { button(container, 'Achieved')!.click(); });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Not yours to change');
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

  it('leaves Escape to the create form while it is open', async () => {
    // Otherwise one key would close the panel out from under a half-written
    // initiative, losing the text.
    const { container, onClose, unmount } = open();
    await flush();
    await act(async () => { button(container, '+ New initiative')!.click(); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });
});
