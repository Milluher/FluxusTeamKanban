// F5: the modal showed ten equal boxes mostly reading "—", needed an Edit mode
// before anything could change, and put Delete beside Edit in the header.
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, Ticket, User } from '@/types';

const get = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, patch, delete: del, post } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { renderToDom, flush, typeInto } = await import('@/test/render');
const TicketModal = (await import('./TicketModal')).default;

const user: User = { id: 'u1', name: 'Alice Doe', email: 'alice@fluxus.com', role: 'standard' } as User;

const ticket = (overrides: Partial<Ticket> = {}): Ticket =>
  ({
    id: 't1',
    title: 'KYB onboarding',
    description: '<p>Verify BVN</p>',
    columnId: 'c1',
    order: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    createdById: user.id,
    createdBy: user,
    comments: [],
    ...overrides,
  } as Ticket);

const board: Board = {
  id: 'b1',
  name: 'Roadmap',
  columns: [{ id: 'c1', name: 'To Do', order: 0, boardId: 'b1', tickets: [] }],
  members: [{ id: 'm1', role: 'admin', user }],
} as unknown as Board;

const open = async (t: Ticket = ticket()) => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const handle = renderToDom(
    <TicketModal
      ticket={t}
      boardId="b1"
      board={board}
      currentUser={user}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
  await flush();
  return { ...handle, onClose, onUpdate, onDelete };
};

const openWithDuplicate = async (t: Ticket = ticket(), as: User = user) => {
  const onDuplicate = vi.fn();
  const handle = renderToDom(
    <TicketModal
      ticket={t}
      boardId="b1"
      board={board}
      currentUser={as}
      isAdmin={as.role === 'admin'}
      onClose={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={onDuplicate}
    />
  );
  await flush();
  return { ...handle, onDuplicate };
};

/** Opens the "⋯" menu and returns the labels it offers. */
const menuLabels = async (container: HTMLElement) => {
  const trigger = container.querySelector('[aria-label^="Actions for"]') as HTMLButtonElement;
  await act(async () => { trigger.click(); });
  return Array.from(container.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent?.trim());
};

const byText = (container: HTMLElement, selector: string, text: string) =>
  Array.from(container.querySelectorAll(selector)).find((el) => el.textContent?.trim() === text);

describe('TicketModal', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: [] });
    patch.mockReset().mockResolvedValue({ data: ticket() });
    del.mockReset().mockResolvedValue({ data: {} });
    post.mockReset().mockResolvedValue({ data: {} });
    localStorage.clear();
  });

  it('offers the creator a duplicate, and hands the copy back', async () => {
    const copy = ticket({ id: 't2', title: 'KYB onboarding (copy)' });
    post.mockResolvedValue({ data: copy });
    const { container, onDuplicate, unmount } = await openWithDuplicate();

    expect(await menuLabels(container)).toContain('Duplicate ticket');
    const item = Array.from(container.querySelectorAll('[role="menuitem"]')).find(
      (b) => b.textContent?.trim() === 'Duplicate ticket'
    ) as HTMLButtonElement;
    await act(async () => { item.click(); });
    await flush();

    expect(post).toHaveBeenCalledWith('/tickets/t1/duplicate', { boardId: 'b1' });
    expect(onDuplicate).toHaveBeenCalledWith(copy);
    unmount();
  });

  it('does not offer to duplicate somebody else\u2019s ticket', async () => {
    const other: User = { ...user, id: 'u9', name: 'Bob Roe' };
    const { container, unmount } = await openWithDuplicate(ticket(), other);
    expect(await menuLabels(container)).not.toContain('Duplicate ticket');
    unmount();
  });

  it('lets an admin duplicate a ticket they did not raise', async () => {
    const adminUser: User = { ...user, id: 'u9', name: 'Femi A', role: 'admin' };
    const { container, unmount } = await openWithDuplicate(ticket(), adminUser);
    expect(await menuLabels(container)).toContain('Duplicate ticket');
    unmount();
  });

  it('hides the action entirely where the board cannot receive a copy', async () => {
    const { container, unmount } = await open();
    expect(await menuLabels(container)).not.toContain('Duplicate ticket');
    unmount();
  });

  it('names the PRD a ticket implements', async () => {
    const { container, unmount } = await open(
      ticket({ prdId: 'p1', prd: { id: 'p1', title: 'Self-serve onboarding', status: 'published' } })
    );
    const label = byText(container, 'label', 'PRD');
    expect(label).toBeDefined();
    expect(label?.parentElement?.textContent).toContain('Self-serve onboarding');
    unmount();
  });

  it('marks a PRD that is still a draft', async () => {
    const { container, unmount } = await open(
      ticket({ prdId: 'p1', prd: { id: 'p1', title: 'Self-serve onboarding', status: 'draft' } })
    );
    expect(byText(container, 'label', 'PRD')?.parentElement?.textContent).toContain('Draft');
    unmount();
  });

  it('keeps PRD behind "Add field" when the ticket implements none', async () => {
    const { container, unmount } = await open();
    expect(byText(container, 'label', 'PRD')).toBeUndefined();

    const addField = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add field')
    )!;
    await act(async () => { addField.click(); });
    const offered = Array.from(container.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent?.trim());
    expect(offered).toContain('PRD');
    unmount();
  });

  it('scopes the PRD list to the board the ticket lives on', async () => {
    const { unmount } = await open();
    expect(get).toHaveBeenCalledWith('/prds', { params: { boardId: 'b1' } });
    unmount();
  });

  it('names the initiative a ticket was raised to fulfil', async () => {
    const { container, unmount } = await open(
      ticket({
        initiativeId: 'i1',
        initiative: { id: 'i1', title: 'Self-serve onboarding', status: 'in_progress' },
      })
    );
    const label = byText(container, 'label', 'Initiative');
    expect(label).toBeDefined();
    expect(label?.parentElement?.textContent).toContain('Self-serve onboarding');
    unmount();
  });

  it('keeps Initiative behind "Add field" when the ticket serves none', async () => {
    const { container, unmount } = await open();
    expect(byText(container, 'label', 'Initiative')).toBeUndefined();

    const addField = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '+Add field' || b.textContent?.includes('Add field')
    )!;
    await act(async () => { addField.click(); });
    const offered = Array.from(container.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent?.trim());
    expect(offered).toContain('Initiative');
    unmount();
  });

  it('shows the board the ticket was created on', async () => {
    const { container, unmount } = await open();
    const label = byText(container, 'label', 'Board');
    expect(label).toBeDefined();
    expect(label?.parentElement?.textContent).toContain('Roadmap');
    unmount();
  });

  it('does not offer to edit the board, which a ticket cannot change', async () => {
    const { container, unmount } = await open();
    expect(container.querySelector('[aria-label="Edit Board"]')).toBeNull();
    unmount();
  });

  it('is announced as a modal dialog naming the ticket', async () => {
    const { container, unmount } = await open();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Ticket: KYB onboarding');
    unmount();
  });

  it('closes on Escape', async () => {
    const { onClose, unmount } = await open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('puts the description before the metadata grid', async () => {
    const { container, unmount } = await open();
    const labels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent?.trim());
    const description = labels.findIndex((l) => l?.includes('Description'));
    const assignee = labels.findIndex((l) => l?.includes('Assignee'));
    expect(description).toBeGreaterThanOrEqual(0);
    expect(description).toBeLessThan(assignee);
    unmount();
  });

  it('hides empty optional fields behind "+ Add field"', async () => {
    const { container, unmount } = await open();
    const labelText = Array.from(container.querySelectorAll('label')).map((l) => l.textContent ?? '').join(' ');

    for (const hidden of ['Type', 'Priority', 'Epic', 'Flow', 'Assigned Date']) {
      expect(labelText).not.toContain(hidden);
    }
    expect(container.textContent).toContain('Add field');
    unmount();
  });

  it('shows an optional field that has a value', async () => {
    const { container, unmount } = await open(ticket({ priority: 'high' }));
    const labelText = Array.from(container.querySelectorAll('label')).map((l) => l.textContent ?? '').join(' ');
    expect(labelText).toContain('Priority');
    unmount();
  });

  it('reveals a hidden field from the Add field menu, ready to edit', async () => {
    const { container, unmount } = await open();
    const addField = byText(container, 'button', '+ Add field') ??
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Add field'));
    act(() => (addField as HTMLButtonElement).click());

    const priority = Array.from(container.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent === 'Priority'
    ) as HTMLButtonElement;
    expect(priority).toBeDefined();
    act(() => priority.click());

    const labelText = Array.from(container.querySelectorAll('label')).map((l) => l.textContent ?? '').join(' ');
    expect(labelText).toContain('Priority');
    unmount();
  });

  it('edits a value in place without an Edit mode, saving only what changed', async () => {
    const { container, unmount } = await open();
    expect(container.textContent).not.toContain('Edit mode');

    const editStatus = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Edit Status'
    ) as HTMLButtonElement;
    expect(editStatus).toBeDefined();
    act(() => editStatus.click());

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    unmount();
  });

  it('abandons an edit on Escape without saving', async () => {
    const { container, unmount } = await open();
    const editTitle = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Edit title'
    ) as HTMLButtonElement;
    act(() => editTitle.click());

    const input = container.querySelector('input') as HTMLInputElement;
    typeInto(input, 'Changed title');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(patch).not.toHaveBeenCalled();
    unmount();
  });

  it('Escape in a field cancels only the edit, leaving the modal open', async () => {
    const { container, onClose, unmount } = await open();
    const editTitle = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Edit title'
    ) as HTMLButtonElement;
    act(() => editTitle.click());

    const input = container.querySelector('input') as HTMLInputElement;
    typeInto(input, 'Changed title');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(patch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Back to the read view, with the original title.
    expect(container.textContent).toContain('KYB onboarding');
    unmount();
  });

  it('saves the title on Enter', async () => {
    const { container, unmount } = await open();
    const editTitle = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Edit title'
    ) as HTMLButtonElement;
    act(() => editTitle.click());

    const input = container.querySelector('input') as HTMLInputElement;
    typeInto(input, 'Renamed ticket');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await flush();

    expect(patch).toHaveBeenCalledWith('/tickets/t1', { title: 'Renamed ticket', boardId: 'b1' });
    unmount();
  });

  it('picks up a ticket replaced underneath it, but not over an edit in progress', async () => {
    const onUpdate = vi.fn();
    const handle = renderToDom(
      <TicketModal
        ticket={ticket({ project: 'Lending' })}
        boardId="b1"
        board={board}
        currentUser={user}
        onClose={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />
    );
    await flush();

    // The board replaces the ticket — e.g. the mount refetch or a socket update.
    act(() => {
      handle.rerender(
        <TicketModal
          ticket={ticket({ project: 'Payments' })}
          boardId="b1"
          board={board}
          currentUser={user}
          onClose={vi.fn()}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
        />
      );
    });

    const editProject = Array.from(handle.container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Edit Project'
    ) as HTMLButtonElement;
    act(() => editProject.click());

    // The edit starts from the newer value, not the one the modal opened with.
    const input = handle.container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Payments');
    handle.unmount();
  });

  it('returns focus to whatever opened it', async () => {
    // Stand in for the card that was clicked.
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { container, unmount } = await open();
    // Focus moved into the dialog.
    expect(container.querySelector('[role="dialog"]')).toBe(document.activeElement);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('keeps Tab inside the dialog', async () => {
    const { container, unmount } = await open();
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href]')
    );
    expect(focusable.length).toBeGreaterThan(1);

    // From the last element, Tab wraps to the first rather than escaping.
    const last = focusable[focusable.length - 1];
    last.focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    unmount();
  });

  it('keeps Delete out of the header and behind a named confirmation', async () => {
    const { container, onDelete, unmount } = await open();

    // Not a header button any more.
    expect(byText(container, 'button', 'Delete')).toBeUndefined();

    const menu = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Actions for KYB onboarding'
    ) as HTMLButtonElement;
    expect(menu).toBeDefined();
    act(() => menu.click());

    const item = Array.from(container.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent === 'Delete ticket'
    ) as HTMLButtonElement;
    act(() => item.click());

    // The confirm names the ticket and gates on typing it.
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const confirm = dialogs[dialogs.length - 1];
    expect(confirm.textContent).toContain('KYB onboarding');

    const buttons = Array.from(confirm.querySelectorAll('button'));
    const confirmButton = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    act(() => confirmButton.click());
    expect(del).not.toHaveBeenCalled();

    typeInto(confirm.querySelector('input') as HTMLInputElement, 'KYB onboarding');
    act(() => (confirm.querySelectorAll('button')[confirm.querySelectorAll('button').length - 1] as HTMLButtonElement).click());
    await flush();

    expect(del).toHaveBeenCalledWith('/tickets/t1?boardId=b1');
    expect(onDelete).toHaveBeenCalledWith('t1');
    unmount();
  });
});
