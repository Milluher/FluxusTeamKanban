import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Persona, User } from '@/types';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, post, patch, delete: del } }));

const { renderToDom, flush, typeInto } = await import('@/test/render');
const PersonasPanel = (await import('./PersonasPanel')).default;

const standard: User = { id: 'u1', name: 'Alice Doe', email: 'alice@fluxus.com', role: 'standard' } as User;
const admin: User = { ...standard, id: 'u2', name: 'Femi A', role: 'admin' };

const persona = (overrides: Partial<Persona> = {}): Persona => ({
  id: 'p1',
  name: 'Smallholder farmer',
  segment: 'Rural',
  description: 'Farms under two hectares.',
  goals: 'Sell at a fair price.',
  painPoints: 'Cash arrives late.',
  behaviours: 'Uses a feature phone daily.',
  techComfort: 'low',
  createdBy: { id: 'u2', name: 'Femi A' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const open = async (user: User = standard) => {
  const onClose = vi.fn();
  const handle = renderToDom(<PersonasPanel user={user} onClose={onClose} />);
  await flush();
  return { ...handle, onClose };
};

const nameButton = (container: HTMLElement, name: string) =>
  Array.from(container.querySelectorAll('button[aria-expanded]')).find(
    (b) => b.textContent?.includes(name)
  ) as HTMLButtonElement;

describe('PersonasPanel', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: [persona()] });
    post.mockReset().mockResolvedValue({ data: persona({ id: 'p2', name: 'Agent' }) });
    patch.mockReset().mockResolvedValue({ data: persona({ name: 'Renamed' }) });
    del.mockReset().mockResolvedValue({ data: {} });
  });

  it('lists names collapsed, and expands one only when it is clicked', async () => {
    const { container, unmount } = await open();
    expect(container.textContent).toContain('Smallholder farmer');
    // Collapsed: the attributes are not on screen yet.
    expect(container.textContent).not.toContain('Farms under two hectares');

    await flush();
    nameButton(container, 'Smallholder farmer').click();
    await flush();

    expect(container.textContent).toContain('Farms under two hectares');
    expect(container.textContent).toContain('Sell at a fair price');
    expect(container.textContent).toContain('Cash arrives late');
    expect(container.textContent).toContain('Low tech comfort');
    unmount();
  });

  it('collapses again on a second click', async () => {
    const { container, unmount } = await open();
    nameButton(container, 'Smallholder farmer').click();
    await flush();
    expect(nameButton(container, 'Smallholder farmer').getAttribute('aria-expanded')).toBe('true');

    nameButton(container, 'Smallholder farmer').click();
    await flush();
    expect(nameButton(container, 'Smallholder farmer').getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Farms under two hectares');
    unmount();
  });

  it('shows personas to a standard user but offers them no way to change one', async () => {
    const { container, unmount } = await open(standard);
    expect(container.textContent).toContain('Smallholder farmer');
    expect(container.textContent).not.toContain('New persona');
    expect(container.querySelector('[aria-label="Actions for Smallholder farmer"]')).toBeNull();
    unmount();
  });

  it('lets an admin create and curate', async () => {
    const { container, unmount } = await open(admin);
    expect(container.textContent).toContain('New persona');
    expect(container.querySelector('[aria-label="Actions for Smallholder farmer"]')).not.toBeNull();
    unmount();
  });

  it('creates a persona from the template, needing only a name', async () => {
    const { container, unmount } = await open(admin);
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('New persona'))!.click();
    await flush();

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    typeInto(container.querySelector('input[aria-label="Name"]') as HTMLInputElement, 'Agent');
    await flush();
    expect(submit.disabled).toBe(false);

    typeInto(container.querySelector('textarea[aria-label="Goals"]') as HTMLTextAreaElement, 'Earn commission.');
    await flush();
    (container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await flush();

    expect(post).toHaveBeenCalledWith('/personas', expect.objectContaining({ name: 'Agent', goals: 'Earn commission.' }));
    unmount();
  });

  it('offers every field of the fixed template', async () => {
    const { container, unmount } = await open(admin);
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('New persona'))!.click();
    await flush();
    const labels = Array.from(container.querySelectorAll('[aria-label]'))
      .map((el) => el.getAttribute('aria-label'))
      .filter((l) => l !== 'Personas' && l !== 'Close personas');
    expect(labels).toEqual(
      expect.arrayContaining(['Name', 'Segment', 'Description', 'Goals', 'Pain points', 'Behaviours', 'Tech comfort'])
    );
    unmount();
  });

  it('says so plainly when a persona is only a name so far', async () => {
    get.mockResolvedValue({
      data: [persona({ segment: null, description: null, goals: null, painPoints: null, behaviours: null, techComfort: null })],
    });
    const { container, unmount } = await open();
    nameButton(container, 'Smallholder farmer').click();
    await flush();
    expect(container.textContent).toContain('Nothing recorded yet beyond the name');
    unmount();
  });

  it('tells a standard user who to ask when there are none', async () => {
    get.mockResolvedValue({ data: [] });
    const { container, unmount } = await open(standard);
    expect(container.textContent).toContain('An admin adds');
    unmount();
  });

  it('reports a refusal in the words the server used', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Only an admin can change personas' } } });
    const { container, unmount } = await open(admin);
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('New persona'))!.click();
    await flush();
    typeInto(container.querySelector('input[aria-label="Name"]') as HTMLInputElement, 'Agent');
    await flush();
    (container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Only an admin can change personas');
    unmount();
  });

  it('closes on Escape', async () => {
    const { onClose, unmount } = await open();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });
});
