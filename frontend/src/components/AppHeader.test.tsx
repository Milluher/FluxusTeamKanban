// F8's claim is that the global header is identical on every page. That is a
// structural property, so it is asserted rather than eyeballed.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '@/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }), patch: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('@/lib/socket', () => ({
  default: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: false },
}));

const { renderToDom } = await import('@/test/render');
const AppHeader = (await import('./AppHeader')).default;

const standard: User = { id: 'u1', name: 'Alice Doe', email: 'alice@fluxus.com', role: 'standard' } as User;
const admin: User = { ...standard, id: 'u2', name: 'Femi A', role: 'admin' };

/** Accessible names of the header's controls, in document order. */
const controls = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('a, button')).map(
    (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
  );

describe('AppHeader', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers the same controls in the same order on every page', () => {
    const seen = (['boards', 'initiatives', 'changelog', 'admin'] as const).map((current) => {
      const { container, unmount } = renderToDom(<AppHeader user={admin} current={current} />);
      const names = controls(container);
      unmount();
      return names;
    });

    expect(seen[0]).toEqual(seen[1]);
    expect(seen[1]).toEqual(seen[2]);
    expect(seen[2]).toEqual(seen[3]);
    expect(seen[0]).toEqual([
      'FluxusTeam home',
      'Riverly Dictionary',
      'Boards',
      'Initiatives',
      'Changelog',
      'Admin',
      'Notifications, no unread',
      'Account menu for Femi A',
    ]);
  });

  it('reaches the dictionary from every page, since a term is looked up anywhere', () => {
    for (const current of ['boards', 'initiatives', 'changelog', 'admin'] as const) {
      const { container, unmount } = renderToDom(<AppHeader user={admin} current={current} />);
      expect(controls(container)).toContain('Riverly Dictionary');
      unmount();
    }
  });

  it('marks only the current page', () => {
    const { container, unmount } = renderToDom(<AppHeader user={admin} current="changelog" />);
    const current = Array.from(container.querySelectorAll('[aria-current="page"]'));
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Changelog');
    unmount();
  });

  it('hides Admin from standard users but keeps the rest identical', () => {
    const { container, unmount } = renderToDom(<AppHeader user={standard} current="boards" />);
    const names = controls(container);
    expect(names).not.toContain('Admin');
    expect(names).toEqual([
      'FluxusTeam home',
      'Riverly Dictionary',
      'Boards',
      'Initiatives',
      'Changelog',
      'Notifications, no unread',
      'Account menu for Alice Doe',
    ]);
    unmount();
  });

  it('reaches the changelog by a visible label rather than an unnamed icon', () => {
    const { container, unmount } = renderToDom(<AppHeader user={standard} current="boards" />);
    const link = container.querySelector('a[href="/changelog"]');
    expect(link).not.toBeNull();
    expect(link?.textContent?.trim()).toBe('Changelog');
    unmount();
  });

  it('places page context in the breadcrumb and page controls before the global ones', () => {
    const { container, unmount } = renderToDom(
      <AppHeader
        user={standard}
        breadcrumb={<h1>Product Roadmap</h1>}
        actions={<button aria-label="Invite">+</button>}
      />
    );
    expect(container.querySelector('h1')?.textContent).toBe('Product Roadmap');
    const names = controls(container);
    expect(names.indexOf('Invite')).toBeLessThan(names.indexOf('Boards'));
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    unmount();
  });
});
