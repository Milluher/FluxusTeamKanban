import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prd, PrdAdminBlock, PrdApprover, User } from '@/types';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, patch, post, delete: del } }));

const { renderToDom, flush, typeInto } = await import('@/test/render');
const { act } = await import('react');

/**
 * React listens for `focusout`, not `blur`, to drive onBlur — blur does not
 * bubble, so dispatching it reaches nothing.
 */
const blurField = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
};
const { PRD_SECTIONS } = await import('@/lib/prdSections');
const PrdBuilderModal = (await import('./PrdBuilderModal')).default;

const prd = (overrides: Partial<Prd> = {}): Prd => ({
  id: 'p1',
  title: 'Self-serve onboarding',
  version: '0.1',
  status: 'draft',
  boardId: 'b1',
  canvasFeatureId: 'f1',
  createdById: 'u1',
  createdBy: { id: 'u1', name: 'Alice Doe' },
  board: { id: 'b1', name: 'Roadmap' },
  canvasFeature: { id: 'f1', text: 'Self-serve onboarding' },
  personas: [],
  adminBlocks: [],
  approvers: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const complete = {
  overview: 'The problem.',
  goals: 'The outcome.',
  inScope: 'This.',
  outOfScope: 'Not that.',
  acceptanceCriteria: 'Given/when/then.',
  successMetrics: 'Activation up 10%.',
};

const author: User = { id: 'u1', name: 'Alice Doe', email: 'a@f.com', role: 'standard' } as User;
const assignee: User = { id: 'u2', name: 'Bob Roe', email: 'b@f.com', role: 'standard' } as User;

const block = (overrides: Partial<PrdAdminBlock> = {}): PrdAdminBlock => ({
  id: 'ab1',
  prdId: 'p1',
  role: 'Compliance',
  assigneeId: assignee.id,
  assignee: { id: assignee.id, name: assignee.name },
  dataNeeded: null,
  actionsNeeded: null,
  ticketId: null,
  ticket: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const reviewer: User = { id: 'u3', name: 'Cara Nwosu', email: 'c@f.com', role: 'standard' } as User;

const approver = (overrides: Partial<PrdApprover> = {}): PrdApprover => ({
  id: 'ap1',
  prdId: 'p1',
  userId: reviewer.id,
  user: { id: reviewer.id, name: reviewer.name },
  status: 'pending',
  note: null,
  decidedAt: null,
  ticketId: null,
  ticket: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const twoApprovers = [approver(), approver({ id: 'ap2', userId: assignee.id, user: { id: assignee.id, name: assignee.name } })];

const open = (p: Prd = prd(), canEdit = true, as: User | null = author) => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  const handle = renderToDom(
    <PrdBuilderModal
      prd={p}
      canEdit={canEdit}
      currentUser={as}
      members={[{ user: author }, { user: assignee }, { user: reviewer }]}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  );
  return { ...handle, onSaved, onClose, onDeleted };
};

const field = (container: HTMLElement, name: string) =>
  container.querySelector(`#prd-${name}`) as HTMLTextAreaElement;

const button = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

describe('PrdBuilderModal', () => {
  beforeEach(() => {
    vi.useRealTimers();
    get.mockReset().mockResolvedValue({ data: [] });
    patch.mockReset().mockImplementation((_url, body) => Promise.resolve({ data: prd(body) }));
    post.mockReset().mockResolvedValue({ data: prd({ status: 'published', publishedAt: new Date().toISOString() }) });
    del.mockReset().mockResolvedValue({ data: {} });
  });

  it('renders every section of the brief, numbered', async () => {
    const { container, unmount } = open();
    await flush();
    for (const s of PRD_SECTIONS) {
      expect(field(container, s.name)).not.toBeNull();
      const label = container.querySelector(`label[for="prd-${s.name}"]`);
      expect(label?.textContent).toContain(`§${s.number}`);
    }
    unmount();
  });

  it('does not write anything back merely by being opened', async () => {
    const { unmount } = open();
    await flush();
    await new Promise((r) => setTimeout(r, 1100));
    await flush();
    expect(patch).not.toHaveBeenCalled();
    unmount();
  });

  it('autosaves the draft after an edit settles', async () => {
    const { container, unmount } = open();
    await flush();
    typeInto(field(container, 'overview'), 'The problem we are solving.');
    await flush();
    expect(patch).not.toHaveBeenCalled(); // debounced, not per-keystroke

    await new Promise((r) => setTimeout(r, 1100));
    await flush();
    expect(patch).toHaveBeenCalledWith('/prds/p1', expect.objectContaining({ overview: 'The problem we are solving.' }));
    unmount();
  });

  it('refuses to publish while a required section is blank, and says which', async () => {
    const { container, unmount } = open();
    await flush();
    button(container, 'Publish').click();
    await flush();

    expect(post).not.toHaveBeenCalled();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Not ready to publish');
    expect(alert?.textContent).toContain('Overview and problem statement');
    expect(alert?.textContent).toContain('Success Metrics');
    unmount();
  });

  it('publishes once the required sections are written and the approvers are named', async () => {
    const { container, onSaved, unmount } = open(prd({ ...complete, approvers: twoApprovers }));
    await flush();
    button(container, 'Publish').click();
    await flush();

    expect(post).toHaveBeenCalledWith('/prds/p1/publish');
    expect(onSaved).toHaveBeenCalled();
    unmount();
  });

  it('shows a published PRD read-only, even to its author', async () => {
    const { container, unmount } = open(
      prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z', approvers: twoApprovers })
    );
    await flush();
    expect(field(container, 'overview').disabled).toBe(true);
    expect(button(container, 'Publish')).toBeUndefined();
    expect(container.textContent).toContain('no longer editable');
    unmount();
  });

  it('shows a draft read-only to somebody who is not its author', async () => {
    const { container, unmount } = open(prd(), false);
    await flush();
    expect(field(container, 'overview').disabled).toBe(true);
    expect(button(container, 'Publish')).toBeUndefined();
    expect(button(container, 'Remove')).toBeUndefined();
    unmount();
  });

  it('offers the personas that exist, and sends the ones picked', async () => {
    get.mockResolvedValue({
      data: [
        { id: 'pe1', name: 'Smallholder farmer', createdBy: { id: 'u1', name: 'A' }, createdAt: '', updatedAt: '' },
        { id: 'pe2', name: 'Agent', createdBy: { id: 'u1', name: 'A' }, createdAt: '', updatedAt: '' },
      ],
    });
    const { container, unmount } = open();
    await flush();

    const chip = button(container, 'Agent');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    chip.click();
    await flush();
    expect(button(container, 'Agent').getAttribute('aria-pressed')).toBe('true');

    await new Promise((r) => setTimeout(r, 1100));
    await flush();
    expect(patch).toHaveBeenCalledWith('/prds/p1', expect.objectContaining({ personaIds: ['pe2'] }));
    unmount();
  });

  it('says so when there are no personas to target yet', async () => {
    const { container, unmount } = open();
    await flush();
    expect(container.textContent).toContain('No personas exist yet');
    unmount();
  });

  it('reports a failed save rather than looking saved', async () => {
    patch.mockRejectedValue({ response: { data: { error: 'Only the author of a PRD can change it' } } });
    const { container, unmount } = open();
    await flush();
    typeInto(field(container, 'goals'), 'Something');
    await flush();
    await new Promise((r) => setTimeout(r, 1100));
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Only the author');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Not saved');
    unmount();
  });

  it('lets the author assign a block to a board member', async () => {
    patch.mockReset();
    post.mockResolvedValue({ data: prd({ adminBlocks: [block()] }) });
    const { container, onSaved, unmount } = open();
    await flush();

    typeInto(container.querySelector('input[aria-label="Block role"]') as HTMLInputElement, 'Compliance');
    const select = container.querySelector('select[aria-label="Block assignee"]') as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, assignee.id);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    button(container, 'Add block').click();
    await flush();

    expect(post).toHaveBeenCalledWith('/prds/p1/admin-blocks', { role: 'Compliance', assigneeId: assignee.id });
    expect(onSaved).toHaveBeenCalled();
    unmount();
  });

  it('asks the assignee the brief\u2019s two questions, and nobody else', async () => {
    const withBlock = prd({ adminBlocks: [block()] });

    const mine = open(withBlock, false, assignee);
    await flush();
    expect(mine.container.textContent).toContain('Data you need');
    expect(mine.container.textContent).toContain('Actions you need to take with this product');
    expect((mine.container.querySelector('#block-ab1-data') as HTMLTextAreaElement).disabled).toBe(false);
    expect(mine.container.textContent).toContain('Yours');
    mine.unmount();

    // The author can see the block but must not answer it.
    const theirs = open(withBlock, true, author);
    await flush();
    expect((theirs.container.querySelector('#block-ab1-data') as HTMLTextAreaElement).disabled).toBe(true);
    theirs.unmount();
  });

  it('saves the assignee\u2019s answers when they leave the field', async () => {
    patch.mockReset().mockResolvedValue({ data: prd({ adminBlocks: [block({ dataNeeded: 'Transaction logs' })] }) });
    const { container, unmount } = open(prd({ adminBlocks: [block()] }), false, assignee);
    await flush();

    const data = container.querySelector('#block-ab1-data') as HTMLTextAreaElement;
    typeInto(data, 'Transaction logs');
    await flush();
    expect(patch).not.toHaveBeenCalled(); // not per keystroke

    await blurField(data);
    await flush();
    expect(patch).toHaveBeenCalledWith('/prds/admin-blocks/ab1', expect.objectContaining({ dataNeeded: 'Transaction logs' }));
    unmount();
  });

  it('does not re-send answers that have not changed', async () => {
    patch.mockReset();
    const { container, unmount } = open(prd({ adminBlocks: [block({ dataNeeded: 'Already here' })] }), false, assignee);
    await flush();
    const data = container.querySelector('#block-ab1-data') as HTMLTextAreaElement;
    await blurField(data);
    await flush();
    expect(patch).not.toHaveBeenCalled();
    unmount();
  });

  it('stops offering new blocks once the PRD is published', async () => {
    const { container, unmount } = open(
      prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z', adminBlocks: [block()] })
    );
    await flush();
    expect(container.querySelector('input[aria-label="Block role"]')).toBeNull();
    expect(container.querySelector('[aria-label="Remove the Compliance block"]')).toBeNull();
    unmount();
  });

  it('shows the task a published block raised', async () => {
    const { container, unmount } = open(
      prd({
        ...complete,
        status: 'published',
        publishedAt: '2026-10-02T00:00:00.000Z',
        adminBlocks: [block({ ticketId: 't9', ticket: { id: 't9', title: 'x', status: 'To Do' } })],
      })
    );
    await flush();
    expect(container.textContent).toContain('To Do');
    unmount();
  });

  it('refuses to publish with fewer than two approvers, and says so', async () => {
    const { container, unmount } = open(prd({ ...complete, approvers: [approver()] }));
    await flush();
    button(container, 'Publish').click();
    await flush();

    expect(post).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('1 more approver');
    unmount();
  });

  it('only offers a decision to the approver, and only after publishing', async () => {
    const draft = prd({ ...complete, approvers: twoApprovers });
    const asReviewerDraft = open(draft, false, reviewer);
    await flush();
    // Nothing to sign off on a draft.
    expect(button(asReviewerDraft.container, 'Approve')).toBeUndefined();
    asReviewerDraft.unmount();

    const live = prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z', approvers: twoApprovers });
    const asReviewer = open(live, false, reviewer);
    await flush();
    expect(button(asReviewer.container, 'Approve')).toBeDefined();
    expect(button(asReviewer.container, 'Request changes')).toBeDefined();
    asReviewer.unmount();

    // The author is not an approver here, so is offered no decision.
    const asAuthor = open(live, true, author);
    await flush();
    expect(button(asAuthor.container, 'Approve')).toBeUndefined();
    asAuthor.unmount();
  });

  it('records an approval, with the note', async () => {
    const live = prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z', approvers: twoApprovers });
    post.mockResolvedValue({ data: live });
    const { container, unmount } = open(live, false, reviewer);
    await flush();

    typeInto(container.querySelector('textarea[aria-label="Decision note"]') as HTMLTextAreaElement, 'Looks right.');
    await flush();
    button(container, 'Approve').click();
    await flush();

    expect(post).toHaveBeenCalledWith('/prds/approvers/ap1/decision', { status: 'approved', note: 'Looks right.' });
    unmount();
  });

  it('records a change request', async () => {
    const live = prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z', approvers: twoApprovers });
    post.mockResolvedValue({ data: live });
    const { container, unmount } = open(live, false, reviewer);
    await flush();
    button(container, 'Request changes').click();
    await flush();
    expect(post).toHaveBeenCalledWith('/prds/approvers/ap1/decision', { status: 'changes_requested', note: '' });
    unmount();
  });

  it('reopens the sections for the author once changes are requested', async () => {
    const changed = prd({
      ...complete,
      status: 'published',
      publishedAt: '2026-10-02T00:00:00.000Z',
      approvers: [approver({ status: 'changes_requested', note: 'Tighten the scope.' }), twoApprovers[1]],
    });
    const { container, unmount } = open(changed, true, author);
    await flush();

    expect(field(container, 'overview').disabled).toBe(false);
    expect(container.textContent).toContain('asked for changes, so the sections are editable again');
    expect(container.textContent).toContain('Tighten the scope.');
    unmount();
  });

  it('keeps a published PRD closed while every decision is approval or pending', async () => {
    const live = prd({
      ...complete,
      status: 'published',
      publishedAt: '2026-10-02T00:00:00.000Z',
      approvers: [approver({ status: 'approved' }), twoApprovers[1]],
    });
    const { container, unmount } = open(live, true, author);
    await flush();
    expect(field(container, 'overview').disabled).toBe(true);
    expect(container.textContent).toContain('no longer editable');
    unmount();
  });

  it('shows where approval stands in the header', async () => {
    const pending = open(
      prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z', approvers: [approver({ status: 'approved' }), twoApprovers[1]] })
    );
    await flush();
    expect(pending.container.textContent).toContain('1 of 2 approved');
    pending.unmount();

    const done = open(
      prd({
        ...complete,
        status: 'published',
        publishedAt: '2026-10-02T00:00:00.000Z',
        approvers: [approver({ status: 'approved' }), approver({ id: 'ap2', userId: assignee.id, user: { id: assignee.id, name: assignee.name }, status: 'approved' })],
      })
    );
    await flush();
    expect(done.container.textContent).toContain('Approved');
    done.unmount();
  });

  it('closes on Escape', async () => {
    const { onClose, unmount } = open();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });
});
