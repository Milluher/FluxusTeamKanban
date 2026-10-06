import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DictionaryTerm, User } from '@/types';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get, post, patch, delete: del } }));

const { renderToDom, flush, typeInto } = await import('@/test/render');
const DictionarySidebar = (await import('./DictionarySidebar')).default;

const alice: User = { id: 'u1', name: 'Alice Doe', email: 'alice@fluxus.com', role: 'standard' } as User;
const bob: User = { id: 'u2', name: 'Bob Roe', email: 'bob@fluxus.com', role: 'standard' } as User;

const term = (overrides: Partial<DictionaryTerm> = {}): DictionaryTerm => ({
  id: 'd1',
  term: 'KYB',
  definition: 'Know Your Business — verifying a company, not a person.',
  createdBy: { id: 'u1', name: 'Alice Doe' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const open = async (user: User = alice) => {
  const onClose = vi.fn();
  const handle = renderToDom(<DictionarySidebar user={user} onClose={onClose} />);
  await flush();
  return { ...handle, onClose };
};

const headings = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('h3')).map((h) => h.textContent);

describe('DictionarySidebar', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: [] });
    post.mockReset();
    patch.mockReset();
    del.mockReset();
  });

  it('is a panel rather than a modal, so the work behind it is not blocked', async () => {
    const { container, unmount } = await open();
    const panel = container.querySelector('aside[aria-label="Riverly Dictionary"]');
    expect(panel).not.toBeNull();
    // A backdrop over the whole viewport would be the thing that blocks it.
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
    unmount();
  });

  it('lists terms alphabetically, ignoring case', async () => {
    get.mockResolvedValue({
      data: [
        term({ id: 'd1', term: 'webhook' }),
        term({ id: 'd2', term: 'API' }),
        term({ id: 'd3', term: 'KYB' }),
      ],
    });
    const { container, unmount } = await open();
    expect(headings(container)).toEqual(['API', 'KYB', 'webhook']);
    unmount();
  });

  it('tags each term with its creator and when it was added', async () => {
    get.mockResolvedValue({ data: [term()] });
    const { container, unmount } = await open();
    expect(container.textContent).toContain('Alice Doe');
    expect(container.textContent).toContain('just now');
    unmount();
  });

  it('lets any member add a term, and files it in alphabetical order', async () => {
    get.mockResolvedValue({ data: [term({ id: 'd1', term: 'API' }), term({ id: 'd2', term: 'Webhook' })] });
    post.mockResolvedValue({ data: term({ id: 'd3', term: 'KYB' }) });

    const { container, unmount } = await open(bob);
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add a term')
    )!;
    addButton.click();
    await flush();

    typeInto(container.querySelector('input[aria-label="Term"]') as HTMLInputElement, 'KYB');
    typeInto(container.querySelector('textarea[aria-label="Definition"]') as HTMLTextAreaElement, 'Know Your Business');
    await flush();

    (container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await flush();

    expect(post).toHaveBeenCalledWith('/dictionary', { term: 'KYB', definition: 'Know Your Business' });
    expect(headings(container)).toEqual(['API', 'KYB', 'Webhook']);
    unmount();
  });

  it('reports a duplicate term in the words the server used', async () => {
    get.mockResolvedValue({ data: [] });
    post.mockRejectedValue({ response: { data: { error: 'That term is already in the dictionary' } } });

    const { container, unmount } = await open();
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Add a term'))!.click();
    await flush();
    typeInto(container.querySelector('input[aria-label="Term"]') as HTMLInputElement, 'KYB');
    typeInto(container.querySelector('textarea[aria-label="Definition"]') as HTMLTextAreaElement, 'dupe');
    await flush();
    (container.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already in the dictionary');
    unmount();
  });

  it('filters by term and by definition', async () => {
    get.mockResolvedValue({
      data: [
        term({ id: 'd1', term: 'API', definition: 'An interface between systems.' }),
        term({ id: 'd2', term: 'KYB', definition: 'Verifying a business.' }),
      ],
    });
    const { container, unmount } = await open();

    typeInto(container.querySelector('input[type="search"]') as HTMLInputElement, 'business');
    await flush();
    expect(headings(container)).toEqual(['KYB']);

    typeInto(container.querySelector('input[type="search"]') as HTMLInputElement, 'api');
    await flush();
    expect(headings(container)).toEqual(['API']);
    unmount();
  });

  it('offers edit and remove on your own term only', async () => {
    get.mockResolvedValue({ data: [term()] });
    const { container, unmount } = await open(bob);
    expect(container.querySelector('[aria-label="Actions for KYB"]')).toBeNull();
    unmount();

    const mine = await open(alice);
    expect(mine.container.querySelector('[aria-label="Actions for KYB"]')).not.toBeNull();
    mine.unmount();
  });

  it('lets an admin curate a term somebody else added', async () => {
    get.mockResolvedValue({ data: [term()] });
    const { container, unmount } = await open({ ...bob, role: 'admin' } as User);
    expect(container.querySelector('[aria-label="Actions for KYB"]')).not.toBeNull();
    unmount();
  });

  it('says the dictionary is empty rather than looking broken', async () => {
    const { container, unmount } = await open();
    expect(container.textContent).toContain('No terms yet');
    unmount();
  });

  it('closes on Escape, so looking a term up costs nothing', async () => {
    const { onClose, unmount } = await open();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });
});
