// Minimal client-side render helper for component tests.
//
// Renders into jsdom through react-dom/client, the same path the app takes in the
// browser, so effects run and DOMParser-based code behaves as it does for real.
// Avoids pulling in a testing library for what is a few lines.
import { act, ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

// React 18 requires this flag before it will allow act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function renderToDom(element: ReactElement): {
  container: HTMLElement;
  rerender: (next: ReactElement) => void;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender: (next: ReactElement) => {
      act(() => {
        root.render(next);
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/**
 * Types into a controlled input the way a person would.
 *
 * React stores the last value it wrote on the DOM node and compares against it,
 * so a plain `el.value = x` is ignored. Writing through the prototype's setter
 * updates the node past React's bookkeeping, and the input event then reaches the
 * onChange handler.
 */
export function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Lets pending promises resolve and React commit the result. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Rendered HTML of `element`, with the tree torn down again. */
export function renderToHtml(element: ReactElement): string {
  const { container, unmount } = renderToDom(element);
  const html = container.innerHTML;
  unmount();
  return html;
}
