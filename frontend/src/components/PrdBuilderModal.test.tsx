import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prd } from '@/types';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, patch, post, delete: del } }));

const { renderToDom, flush, typeInto } = await import('@/test/render');
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

const open = (p: Prd = prd(), canEdit = true) => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  const handle = renderToDom(
    <PrdBuilderModal prd={p} canEdit={canEdit} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
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

  it('publishes once the required sections are written', async () => {
    const { container, onSaved, unmount } = open(prd(complete));
    await flush();
    button(container, 'Publish').click();
    await flush();

    expect(post).toHaveBeenCalledWith('/prds/p1/publish');
    expect(onSaved).toHaveBeenCalled();
    unmount();
  });

  it('shows a published PRD read-only, even to its author', async () => {
    const { container, unmount } = open(prd({ ...complete, status: 'published', publishedAt: '2026-10-02T00:00:00.000Z' }));
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

  it('closes on Escape', async () => {
    const { onClose, unmount } = open();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });
});
