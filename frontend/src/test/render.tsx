// Minimal client-side render helper for component tests.
//
// Renders into jsdom through react-dom/client, the same path the app takes in the
// browser, so effects run and DOMParser-based code behaves as it does for real.
// Avoids pulling in a testing library for what is a few lines.
import { act, ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

// React 18 requires this flag before it will allow act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function renderToDom(element: ReactElement): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Rendered HTML of `element`, with the tree torn down again. */
export function renderToHtml(element: ReactElement): string {
  const { container, unmount } = renderToDom(element);
  const html = container.innerHTML;
  unmount();
  return html;
}
