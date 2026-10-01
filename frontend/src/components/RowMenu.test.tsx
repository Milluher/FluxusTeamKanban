import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToDom } from '@/test/render';
import RowMenu from './RowMenu';

describe('RowMenu', () => {
  const open = (onSelect = vi.fn()) => {
    const handle = renderToDom(
      <RowMenu label="Actions for Product Roadmap" items={[{ label: 'Delete board', destructive: true, onSelect }]} />
    );
    const trigger = handle.container.querySelector('button') as HTMLButtonElement;
    act(() => trigger.click());
    return { ...handle, trigger, onSelect };
  };

  it('hides destructive actions until the menu is opened', () => {
    const handle = renderToDom(
      <RowMenu label="Actions for Product Roadmap" items={[{ label: 'Delete board', onSelect: vi.fn() }]} />
    );
    expect(handle.container.querySelector('[role="menu"]')).toBeNull();
    expect(handle.container.textContent).not.toContain('Delete board');
    handle.unmount();
  });

  it('is announced as a menu button with its row named', () => {
    const { trigger, container, unmount } = open();
    expect(trigger.getAttribute('aria-label')).toBe('Actions for Product Roadmap');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="menuitem"]')?.textContent).toBe('Delete board');
    unmount();
  });

  it('runs the action once and closes', () => {
    const { container, onSelect, unmount } = open();
    const item = container.querySelector('[role="menuitem"]') as HTMLButtonElement;
    act(() => item.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="menu"]')).toBeNull();
    unmount();
  });

  it('closes on Escape without running anything', () => {
    const { container, onSelect, unmount } = open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    unmount();
  });

  it('closes on an outside click', () => {
    const { container, unmount } = open();
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    unmount();
  });
});
