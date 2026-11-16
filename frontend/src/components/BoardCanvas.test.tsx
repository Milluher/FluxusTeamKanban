import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasFeature, CanvasProject, Prd, User } from '@/types';

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
  text: 'Apple Pay at checkout',
  active: true,
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

/** A whole PRD: the builder reads every section and list on the document. */
const prd = (over: Partial<Prd> = {}): Prd => ({
  id: 'prd1',
  title: 'Checkout 2.0',
  version: null,
  status: 'draft',
  boardId: 'b1',
  canvasProjectId: null,
  canvasProject: null,
  canvasFeatureId: null,
  createdById: admin.id,
  createdBy: { id: admin.id, name: admin.name },
  board: { id: 'b1', name: 'Roadmap' },
  canvasFeature: null,
  personas: [],
  adminBlocks: [],
  approvers: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const open = (
  { projects = [project()], prds = [] as Prd[], isAdmin = true } = {}
) => {
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/canvas') ? projects : url === '/prds' ? prds : [] })
  );
  return renderToDom(
    <BoardCanvas boardId="b1" isAdmin={isAdmin} currentUser={admin} members={[{ user: admin }]} />
  );
};

const button = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

const featureField = (container: HTMLElement) =>
  container.querySelector('input[aria-label="Add a feature to Onboarding"]') as HTMLInputElement;

beforeEach(() => {
  get.mockReset();
  patch.mockReset().mockResolvedValue({ data: {} });
  post.mockReset().mockImplementation((url, body) =>
    Promise.resolve({
      data: url === '/prds'
        ? prd({ ...body, id: 'new-prd' })
        : { id: 'new', blockId: 'bl1', order: 1, active: true, ...body },
    })
  );
  del.mockReset().mockResolvedValue({ data: {} });
});

describe('BoardCanvas — adding a feature to a block', () => {
  it('adds the feature and nothing else', async () => {
    // A feature is one line on the canvas. It used to start a PRD, which put a
    // long document behind a bullet point.
    const { container, unmount } = open();
    await flush();

    const input = featureField(container);
    typeInto(input, 'Apple Pay');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await flush();

    expect(post).toHaveBeenCalledWith('/boards/b1/canvas/blocks/bl1/features', { text: 'Apple Pay' });
    expect(post).not.toHaveBeenCalledWith('/prds', expect.anything());
    unmount();
  });

  it('asks nothing about PRDs on the way', async () => {
    const { container, unmount } = open();
    await flush();
    const input = featureField(container);
    typeInto(input, 'Apple Pay');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await flush();
    expect(container.textContent).not.toContain('Does this need a PRD?');
    unmount();
  });

  it('keeps what was typed when the field is left, rather than discarding it', async () => {
    const { container, unmount } = open();
    await flush();
    const input = featureField(container);
    typeInto(input, 'Saved on blur');
    await act(async () => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await flush();
    expect(post).toHaveBeenCalledWith('/boards/b1/canvas/blocks/bl1/features', { text: 'Saved on blur' });
    unmount();
  });

  it('offers no PRD on a feature that has none', async () => {
    const { container, unmount } = open({ projects: [project([feature()])] });
    await flush();
    expect(button(container, '+ PRD')).toBeUndefined();
    expect(button(container, 'PRD')).toBeUndefined();
    unmount();
  });
});

describe('BoardCanvas — products', () => {
  it('lists the products of the project being viewed, with where each stands', async () => {
    const { container, unmount } = open({
      prds: [
        prd({ id: 'mine', title: 'Checkout 2.0', canvasProjectId: 'p1' }),
        prd({ id: 'elsewhere', title: 'Other project', canvasProjectId: 'p2' }),
      ],
    });
    await flush();
    expect(container.textContent).toContain('Checkout 2.0');
    expect(container.textContent).toContain('Draft');
    expect(container.textContent).not.toContain('Other project');
    unmount();
  });

  it('creates the product and opens its PRD', async () => {
    const { container, unmount } = open();
    await flush();

    button(container, 'Product')!.click();
    await flush();
    typeInto(container.querySelector('input[type="text"]') as HTMLInputElement, 'Checkout 2.0');
    await flush();
    button(container, 'Create & open PRD')!.click();
    await flush();

    expect(post).toHaveBeenCalledWith('/prds', {
      boardId: 'b1',
      canvasProjectId: 'p1',
      title: 'Checkout 2.0',
    });
    // The builder is the point of a product, so it opens on creation.
    expect(container.querySelector('[aria-label^="PRD:"]')).not.toBeNull();
    unmount();
  });

  it('says what naming a product is about to do', async () => {
    // Creating one jumps straight into a long form, which is a bigger step than
    // the other prompts on this canvas take.
    const { container, unmount } = open();
    await flush();
    button(container, 'Product')!.click();
    await flush();
    expect(container.textContent).toContain('opens the builder');
    unmount();
  });

  it('opens an existing product when its card is clicked', async () => {
    const { container, unmount } = open({
      prds: [prd({ title: 'Checkout 2.0', canvasProjectId: 'p1' })],
    });
    await flush();
    button(container, 'Checkout 2.0Draft')!.click();
    await flush();
    expect(container.querySelector('[aria-label="PRD: Checkout 2.0"]')).not.toBeNull();
    unmount();
  });

  it('keeps adding products to admins', async () => {
    const { container, unmount } = open({
      prds: [prd({ title: 'Checkout 2.0', canvasProjectId: 'p1' })],
      isAdmin: false,
    });
    await flush();
    // A member still sees the product and can read it.
    expect(container.textContent).toContain('Checkout 2.0');
    expect(button(container, 'Product')).toBeUndefined();
    unmount();
  });

  it('shows a member no empty Products row to wonder about', async () => {
    const { container, unmount } = open({ isAdmin: false });
    await flush();
    expect(container.textContent).not.toContain('Products');
    unmount();
  });
});

describe('BoardCanvas — the PRDs features already had', () => {
  const attached = prd({ id: 'legacy', title: 'Apple Pay at checkout', canvasFeatureId: 'f1' });

  it('still opens from the feature it was written for', async () => {
    // These predate products. Stranding them would lose the thinking behind a
    // line that is still on the canvas.
    const { container, unmount } = open({
      projects: [project([feature()])],
      prds: [attached],
    });
    await flush();
    const badge = button(container, 'PRD')!;
    expect(badge).toBeDefined();
    badge.click();
    await flush();
    expect(container.querySelector('[aria-label="PRD: Apple Pay at checkout"]')).not.toBeNull();
    unmount();
  });

  it('shows one to a member too, not only to admins', async () => {
    const { container, unmount } = open({
      projects: [project([feature()])],
      prds: [attached],
      isAdmin: false,
    });
    await flush();
    expect(button(container, 'PRD')).toBeDefined();
    unmount();
  });

  it('does not list a feature PRD among the products', async () => {
    const { container, unmount } = open({
      projects: [project([feature()])],
      prds: [attached],
    });
    await flush();
    // It belongs to no project, so the Products row offers only the add card.
    const productsRow = container.querySelector('h4')?.parentElement?.parentElement;
    expect(productsRow?.textContent).not.toContain('Apple Pay at checkout');
    unmount();
  });
});
