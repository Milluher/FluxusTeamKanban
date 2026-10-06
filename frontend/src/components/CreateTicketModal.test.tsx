// The draft rules themselves are covered in lib/ticketDraft.test.ts. What is
// asserted here is the wiring: that the form starts from a stored draft, says
// so, keeps itself saved, and stops keeping it once the ticket exists.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, Ticket } from '@/types';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, post } }));

// The rich-text editor is a dynamic import of a TipTap tree; the create form
// only needs it to exist.
vi.mock('next/dynamic', () => ({
  default: () => function StubEditor() {
    return <div data-testid="editor" />;
  },
}));

const { renderToDom, flush, typeInto } = await import('@/test/render');
const { draftKey, readDraft, writeDraft } = await import('@/lib/ticketDraft');
const CreateTicketModal = (await import('./CreateTicketModal')).default;

const board: Board = {
  id: 'b1',
  name: 'Roadmap',
  type: 'sprint',
  columns: [{ id: 'c1', name: 'To Do', order: 0, boardId: 'b1', tickets: [] }],
  members: [{ id: 'm1', role: 'admin', user: { id: 'u1', name: 'Alice Doe' } as never }],
} as unknown as Board;

const key = draftKey('b1', 'c1', 'u1');

const open = async () => {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  const handle = renderToDom(
    <CreateTicketModal
      columnId="c1"
      boardId="b1"
      board={board}
      onClose={onClose}
      onCreate={onCreate}
    />
  );
  await flush();
  return { ...handle, onCreate, onClose };
};

const titleInput = (container: HTMLElement) =>
  container.querySelector('input[type="text"]') as HTMLInputElement;

describe('CreateTicketModal drafts', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Alice Doe' }));
    get.mockReset().mockResolvedValue({ data: [] });
    post.mockReset().mockResolvedValue({ data: { id: 't1', title: 'KYB' } as Ticket });
  });

  it('starts blank, and says nothing about drafts, when there is none', async () => {
    const { container, unmount } = await open();
    expect(titleInput(container).value).toBe('');
    expect(container.querySelector('[role="status"]')).toBeNull();
    unmount();
  });

  it('keeps what is typed, so an interruption costs nothing', async () => {
    const { container, unmount } = await open();
    typeInto(titleInput(container), 'KYB onboarding');
    await flush();
    expect(readDraft(key)).toMatchObject({ title: 'KYB onboarding' });
    unmount();
  });

  it('comes back from a stored draft and says that it did', async () => {
    writeDraft(key, { title: 'Half-written', priority: 'high' });
    const { container, unmount } = await open();
    expect(titleInput(container).value).toBe('Half-written');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('unfinished draft');
    unmount();
  });

  it('does not overwrite the stored draft with a blank form on open', async () => {
    writeDraft(key, { title: 'Precious' });
    const { unmount } = await open();
    await flush();
    expect(readDraft(key)).toMatchObject({ title: 'Precious' });
    unmount();
  });

  it('discards the draft on request, emptying the form', async () => {
    writeDraft(key, { title: 'Half-written' });
    const { container, unmount } = await open();
    const discard = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Discard draft'
    )!;
    discard.click();
    await flush();

    expect(titleInput(container).value).toBe('');
    expect(readDraft(key)).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    unmount();
  });

  it('forgets the draft once the ticket actually exists', async () => {
    const { container, unmount } = await open();
    typeInto(titleInput(container), 'KYB onboarding');
    await flush();
    expect(readDraft(key)).not.toBeNull();

    (container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await flush();

    expect(post).toHaveBeenCalled();
    expect(readDraft(key)).toBeNull();
    unmount();
  });

  it('keeps the draft when creation fails, so the work is not lost twice', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Failed to create ticket' } } });
    const { container, unmount } = await open();
    typeInto(titleInput(container), 'KYB onboarding');
    await flush();
    (container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await flush();

    expect(readDraft(key)).toMatchObject({ title: 'KYB onboarding' });
    unmount();
  });
});
