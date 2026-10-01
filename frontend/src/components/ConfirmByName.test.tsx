// Nothing in this backend is a soft delete and there is no restore endpoint, so
// this dialog is the only guard. Its gate is tested rather than assumed.
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToDom, typeInto } from '@/test/render';
import ConfirmByName from './ConfirmByName';

const setup = (overrides: Partial<Parameters<typeof ConfirmByName>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const { container, unmount } = renderToDom(
    <ConfirmByName
      title="Delete board"
      name="Product Roadmap"
      description="This cannot be undone."
      confirmLabel="Delete board"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  const input = container.querySelector('input') as HTMLInputElement;
  // Last button in the dialog: its label changes to "Deleting…" while busy, so
  // position is steadier than text.
  const buttons = Array.from(container.querySelectorAll('button'));
  const confirm = buttons[buttons.length - 1] as HTMLButtonElement;
  const type = (value: string) => typeInto(input, value);
  return { container, unmount, onConfirm, onCancel, input, confirm, type };
};

describe('ConfirmByName', () => {
  it('keeps confirm disabled until the name matches exactly', () => {
    const { confirm, type, unmount } = setup();
    expect(confirm.disabled).toBe(true);

    type('Product');
    expect(confirm.disabled).toBe(true);

    type('product roadmap');
    expect(confirm.disabled).toBe(true); // case matters

    type('Product Roadmap ');
    expect(confirm.disabled).toBe(true); // trailing space matters

    type('Product Roadmap');
    expect(confirm.disabled).toBe(false);
    unmount();
  });

  it('does not delete on a click while the gate is closed', () => {
    const { confirm, onConfirm, unmount } = setup();
    act(() => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });

  it('deletes once the name matches', () => {
    const { confirm, type, onConfirm, unmount } = setup();
    type('Product Roadmap');
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores Enter until the name matches', () => {
    const { input, type, onConfirm, unmount } = setup();
    const enter = () =>
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

    type('wrong');
    enter();
    expect(onConfirm).not.toHaveBeenCalled();

    type('Product Roadmap');
    enter();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('will not fire twice while a delete is in flight', () => {
    const { confirm, type, onConfirm, unmount } = setup({ busy: true });
    type('Product Roadmap');
    expect(confirm.disabled).toBe(true);
    act(() => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });

  it('cancels on Escape and shows a failure inline', () => {
    const { onCancel, unmount } = setup({ error: 'Failed to delete board' });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    const second = setup({ error: 'Failed to delete board' });
    expect(second.container.textContent).toContain('Failed to delete board');
    second.unmount();
  });

  it('names what is being deleted and is announced as a dialog', () => {
    const { container, unmount } = setup();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Product Roadmap');
    unmount();
  });
});
