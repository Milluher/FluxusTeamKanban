import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasFeature, CanvasProject, User } from '@/types';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, patch, post, delete: del } }));
vi.mock('@/lib/socket', () => ({ default: { on: vi.fn(), off: vi.fn() } }));

const { renderToDom, flush, typeInto } = await import('@/test/render');
const { act } = await import('react');
const BoardCanvas = (await import('./BoardCanvas')).default;

const admin: User = { id: 'u1', name: 'Alice Doe', email: 'a@f.com', role: 'admin' } as User;

const feature = (over: Partial<CanvasFeature> = {}): CanvasFeature => ({
  id: 'f1',
  blockId: 'bl1',
  text: 'Self-serve onboarding',
  active: true,
  requiresPrd: true,
  order: 0,
  ...over,
});

const project = (features: CanvasFeature[] = []): CanvasProject => ({
  id: 'p1',
  boardId: 'b1',
  name: 'Mobile App',
  order: 0,
  blocks: [{ id: 'bl1', projectId: 'p1', title: 'Onboarding', order: 0, features }],
});

const open = (projects: CanvasProject[] = [project()], isAdmin = true) => {
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/canvas') ? projects : [] })
  );
  return renderToDom(<BoardCanvas boardId="b1" isAdmin={isAdmin} currentUser={admin} members={[{ user: admin }]} />);
};

const button = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

/** The two choice cards carry a description as well as a label. */
const choice = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith(label));

/**
 * Starting a PRD opens the builder, which reads every section and every list on
 * the document — so the stub has to be a whole PRD, not just an id.
 */
const newPrd = (body: Record<string, unknown>) => ({
  id: 'prd1',
  title: String(body.title ?? ''),
  version: null,
  status: 'draft',
  boardId: 'b1',
  canvasFeatureId: body.canvasFeatureId ?? null,
  createdById: admin.id,
  createdBy: { id: admin.id, name: admin.name },
  board: { id: 'b1', name: 'Roadmap' },
  canvasFeature: null,
  personas: [],
  adminBlocks: [],
  approvers: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
});

/** Types a feature name into a block's inline field and presses Enter. */
const startAdding = async (container: HTMLElement, text: string) => {
  const input = container.querySelector(
    'input[aria-label="Add a feature to Onboarding"]'
  ) as HTMLInputElement;
  typeInto(input, text);
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await flush();
};

describe('BoardCanvas — adding a feature', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset().mockResolvedValue({ data: {} });
    post.mockReset().mockImplementation((url, body) =>
      Promise.resolve({
        data: url === '/prds'
          ? newPrd(body)
          : { id: 'new', blockId: 'bl1', order: 1, active: true, ...body },
      })
    );
    del.mockReset().mockResolvedValue({ data: {} });
  });

  it('asks whether the feature needs a PRD before creating anything', async () => {
    const { container, unmount } = open();
    await flush();
    await startAdding(container, 'Passkey sign-in');

    expect(post).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Does this need a PRD?');
    expect(container.textContent).toContain('Mini feature');
    unmount();
  });

  it('creates a mini feature without starting a PRD', async () => {
    const { container, unmount } = open();
    await flush();
    await startAdding(container, 'Rename the CTA');

    choice(container, 'Mini feature')!.click();
    await flush();
    button(container, 'Add feature')!.click();
    await flush();

    expect(post).toHaveBeenCalledWith('/boards/b1/canvas/blocks/bl1/features', {
      text: 'Rename the CTA',
      requiresPrd: false,
    });
    // The builder is the thing a mini feature is meant to skip.
    expect(post).not.toHaveBeenCalledWith('/prds', expect.anything());
    unmount();
  });

  it('starts the PRD when the feature is said to need one', async () => {
    const { container, unmount } = open();
    await flush();
    await startAdding(container, 'Passkey sign-in');

    // "Needs a PRD" is the default, so the button goes straight through.
    button(container, 'Add & start PRD')!.click();
    await flush();

    expect(post).toHaveBeenCalledWith('/boards/b1/canvas/blocks/bl1/features', {
      text: 'Passkey sign-in',
      requiresPrd: true,
    });
    expect(post).toHaveBeenCalledWith('/prds', {
      boardId: 'b1',
      canvasFeatureId: 'new',
      title: 'Passkey sign-in',
    });
    unmount();
  });

  it('creates nothing when the question is dismissed', async () => {
    const { container, unmount } = open();
    await flush();
    await startAdding(container, 'Half a thought');

    button(container, 'Cancel')!.click();
    await flush();
    expect(post).not.toHaveBeenCalled();
    unmount();
  });
});

describe('BoardCanvas — how a feature reads afterwards', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset().mockResolvedValue({ data: {} });
    post.mockReset().mockImplementation((_url, body) => Promise.resolve({ data: newPrd(body) }));
    del.mockReset().mockResolvedValue({ data: {} });
  });

  it('marks a mini feature as settled rather than as a missing PRD', async () => {
    const { container, unmount } = open([project([feature({ requiresPrd: false })])]);
    await flush();
    expect(button(container, 'Mini')).toBeDefined();
    expect(button(container, '+ PRD')).toBeUndefined();
    unmount();
  });

  it('still invites a PRD on a feature that was said to need one', async () => {
    const { container, unmount } = open([project([feature()])]);
    await flush();
    expect(button(container, '+ PRD')).toBeDefined();
    unmount();
  });

  it('records the change of mind when a mini feature gets a PRD after all', async () => {
    // Otherwise the feature would still claim it needs nothing while a document
    // hangs off it.
    const { container, unmount } = open([project([feature({ requiresPrd: false })])]);
    await flush();
    button(container, 'Mini')!.click();
    await flush();

    expect(patch).toHaveBeenCalledWith('/boards/b1/canvas/features/f1', { requiresPrd: true });
    expect(post).toHaveBeenCalledWith('/prds', {
      boardId: 'b1',
      canvasFeatureId: 'f1',
      title: 'Self-serve onboarding',
    });
    unmount();
  });

  it('shows a member a mini feature as a label, not a button', async () => {
    const { container, unmount } = open([project([feature({ requiresPrd: false })])], false);
    await flush();
    expect(button(container, 'Mini')).toBeUndefined();
    expect(container.textContent).toContain('Mini');
    unmount();
  });
});
