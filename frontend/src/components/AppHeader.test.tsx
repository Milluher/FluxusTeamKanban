// F8's claim is that the global header is identical on every page. That is a
// structural property, so it is asserted rather than eyeballed.
import { act } from 'react';
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
    const seen = (['boards', 'admin'] as const).map((current) => {
      const { container, unmount } = renderToDom(<AppHeader user={admin} current={current} />);
      const names = controls(container);
      unmount();
      return names;
    });

    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0]).toEqual([
      'FluxusTeam home',
      'Personas',
      'Initiatives',
      'Riverly Dictionary',
      'Changelog',
      'Boards',
      'Admin',
      'Notifications, no unread',
      'Account menu for Femi A',
    ]);
  });

  it('reaches every panel from every page, since each is consulted mid-task', () => {
    for (const current of ['boards', 'admin'] as const) {
      const { container, unmount } = renderToDom(<AppHeader user={admin} current={current} />);
      for (const panel of ['Personas', 'Initiatives', 'Riverly Dictionary', 'Changelog']) {
        expect(controls(container)).toContain(panel);
      }
      unmount();
    }
  });

  it('opens initiatives and the changelog beside the page rather than navigating', () => {
    // Both answer a question you ask while looking at the work, so reading
    // either must not cost you the board or the sprint you had open.
    const { container, unmount } = renderToDom(<AppHeader user={standard} current="boards" />);
    expect(container.querySelector('a[href="/initiatives"]')).toBeNull();
    expect(container.querySelector('a[href="/changelog"]')).toBeNull();

    for (const label of ['Initiatives', 'Changelog']) {
      expect(container.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
    }
    unmount();
  });

  it('shows one panel at a time, since they share the same space', async () => {
    const { container, unmount } = renderToDom(<AppHeader user={standard} current="boards" />);
    const byLabel = (label: string) =>
      container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

    await act(async () => { byLabel('Personas').click(); });
    expect(container.querySelector('aside[aria-label="Personas"]')).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Riverly Dictionary"]')).toBeNull();

    await act(async () => { byLabel('Riverly Dictionary').click(); });
    expect(container.querySelector('aside[aria-label="Riverly Dictionary"]')).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Personas"]')).toBeNull();

    await act(async () => { byLabel('Initiatives').click(); });
    expect(container.querySelector('aside[aria-label="Initiatives"]')).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Riverly Dictionary"]')).toBeNull();

    await act(async () => { byLabel('Changelog').click(); });
    expect(container.querySelector('aside[aria-label="Changelog"]')).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Initiatives"]')).toBeNull();

    // Clicking the open one again closes it.
    await act(async () => { byLabel('Changelog').click(); });
    expect(container.querySelector('aside')).toBeNull();
    unmount();
  });

  it('marks only the current page', () => {
    const { container, unmount } = renderToDom(<AppHeader user={admin} current="boards" />);
    const current = Array.from(container.querySelectorAll('[aria-current="page"]'));
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Boards');
    unmount();
  });

  it('hides Admin from standard users but keeps the rest identical', () => {
    const { container, unmount } = renderToDom(<AppHeader user={standard} current="boards" />);
    const names = controls(container);
    expect(names).not.toContain('Admin');
    expect(names).toEqual([
      'FluxusTeam home',
      'Personas',
      'Initiatives',
      'Riverly Dictionary',
      'Changelog',
      'Boards',
      'Notifications, no unread',
      'Account menu for Alice Doe',
    ]);
    unmount();
  });

  it('names every panel toggle, rather than leaving an unlabelled icon', () => {
    // These are icon buttons at narrow widths, so the accessible name is the
    // only name they have.
    const { container, unmount } = renderToDom(<AppHeader user={standard} current="boards" />);
    for (const label of ['Personas', 'Initiatives', 'Riverly Dictionary', 'Changelog']) {
      const toggle = container.querySelector(`button[aria-label="${label}"]`);
      expect(toggle).not.toBeNull();
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    }
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
    expect(names.indexOf('Invite')).toBeLessThan(names.indexOf('Personas'));
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    unmount();
  });
});
