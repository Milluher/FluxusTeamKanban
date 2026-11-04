import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Initiative } from '@/types';

const post = vi.fn();
const patch = vi.fn();
// `get` is only reached by the board picker, which the modal shows when it is
// opened without a board — the workspace-level /initiatives page.
const get = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, post, patch } }));

const { renderToDom, flush, typeInto, chooseOption } = await import('@/test/render');
const InitiativeModal = (await import('./InitiativeModal')).default;

const initiative = (overrides: Partial<Initiative> = {}): Initiative => ({
  id: 'i1',
  title: 'Make onboarding self-serve',
  description: 'Cut the manual steps between signup and first board.',
  status: 'in_progress',
  boardId: 'b1',
  board: { id: 'b1', name: 'Riverly' },
  createdById: 'u1',
  createdBy: { id: 'u1', name: 'Alice Doe' },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  tickets: [],
  ...overrides,
});

// `boardId` defaults to a board, which is the case where the caller already
// knows it. Pass `null` to get the picker — `null` rather than `undefined`
// because a default parameter is applied to `undefined` too.
const open = (existing: Initiative | null = null, boardId: string | null = 'b1') => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const handle = renderToDom(
    <InitiativeModal
      initiative={existing}
      boardId={boardId ?? undefined}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
  return { ...handle, onClose, onSaved };
};

const submitButton = (container: HTMLElement) =>
  container.querySelector('button[type="submit"]') as HTMLButtonElement;

describe('InitiativeModal', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({
      data: [
        { id: 'b1', name: 'Riverly' },
        { id: 'b2', name: 'Atlas' },
      ],
    });
    post.mockReset().mockResolvedValue({ data: initiative() });
    patch.mockReset().mockResolvedValue({ data: initiative() });
  });

  it('asks the two questions the brief asks, in its words', () => {
    const { container, unmount } = open();
    const labels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['What is this initiative?', 'A bit more about it']);
    unmount();
  });

  it('will not submit until both fields are filled, since both are required', async () => {
    const { container, unmount } = open();
    expect(submitButton(container).disabled).toBe(true);

    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, 'Self-serve onboarding');
    await flush();
    expect(submitButton(container).disabled).toBe(true);

    typeInto(container.querySelector('#initiative-description') as HTMLTextAreaElement, 'Why it matters.');
    await flush();
    expect(submitButton(container).disabled).toBe(false);
    unmount();
  });

  it('creates an initiative and hands it back', async () => {
    const { container, onSaved, unmount } = open();
    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, 'Self-serve onboarding');
    typeInto(container.querySelector('#initiative-description') as HTMLTextAreaElement, 'Why it matters.');
    await flush();
    submitButton(container).click();
    await flush();

    expect(post).toHaveBeenCalledWith('/initiatives', {
      title: 'Self-serve onboarding',
      description: 'Why it matters.',
      boardId: 'b1',
    });
    expect(onSaved).toHaveBeenCalled();
    unmount();
  });

  it('edits an existing one through PATCH, pre-filled', async () => {
    const existing = initiative();
    const { container, unmount } = open(existing);
    expect((container.querySelector('#initiative-title') as HTMLInputElement).value).toBe(existing.title);

    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, 'Renamed');
    await flush();
    submitButton(container).click();
    await flush();

    expect(patch).toHaveBeenCalledWith(`/initiatives/${existing.id}`, {
      title: 'Renamed',
      description: existing.description,
    });
    expect(post).not.toHaveBeenCalled();
    unmount();
  });

  it('reports a refusal in the words the server used', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Say what the initiative is' } } });
    const { container, onSaved, unmount } = open();
    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, ' ');
    typeInto(container.querySelector('#initiative-description') as HTMLTextAreaElement, 'Body');
    await flush();
    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, 'x');
    await flush();
    submitButton(container).click();
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Say what the initiative is');
    expect(onSaved).not.toHaveBeenCalled();
    unmount();
  });

  // --- board scoping ---

  it('asks which board when it is opened without one, and will not submit until told', async () => {
    const { container, unmount } = open(null, null);
    await flush();

    const picker = container.querySelector('#initiative-board') as HTMLSelectElement;
    expect(picker).not.toBeNull();
    expect(Array.from(container.querySelectorAll('label')).map((l) => l.textContent?.trim())).toEqual([
      'Which board is it for?',
      'What is this initiative?',
      'A bit more about it',
    ]);

    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, 'Self-serve onboarding');
    typeInto(container.querySelector('#initiative-description') as HTMLTextAreaElement, 'Why it matters.');
    await flush();
    // Both questions answered; only the board is missing.
    expect(submitButton(container).disabled).toBe(true);

    chooseOption(picker, 'b2');
    await flush();
    expect(submitButton(container).disabled).toBe(false);

    submitButton(container).click();
    await flush();
    expect(post).toHaveBeenCalledWith('/initiatives', {
      title: 'Self-serve onboarding',
      description: 'Why it matters.',
      boardId: 'b2',
    });
    unmount();
  });

  it('never asks an edit which board, and never moves one', async () => {
    const existing = initiative({ boardId: 'b1' });
    const { container, unmount } = open(existing, null);
    await flush();

    // An edit form that could move work to another board without saying so is
    // a trap, so the question is create-time only.
    expect(container.querySelector('#initiative-board')).toBeNull();

    typeInto(container.querySelector('#initiative-title') as HTMLInputElement, 'Renamed');
    await flush();
    submitButton(container).click();
    await flush();

    expect(patch).toHaveBeenCalledWith(`/initiatives/${existing.id}`, {
      title: 'Renamed',
      description: existing.description,
    });
    unmount();
  });

  it('does not fetch the board list when the caller already named one', async () => {
    const { unmount } = open(null, 'b1');
    await flush();
    expect(get).not.toHaveBeenCalled();
    unmount();
  });
});
