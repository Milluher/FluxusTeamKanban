import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderToDom } from '@/test/render';
import BoardColumnPager from './BoardColumnPager';

const COLUMNS = [
  { id: 'c1', name: 'To Do', count: 3 },
  { id: 'c2', name: 'In Progress', count: 1 },
  { id: 'c3', name: 'Done', count: 0 },
];

const domId = (id: string) => `board-col-${id}`;

/**
 * jsdom has no IntersectionObserver and no layout, so the observer is stubbed
 * and `scrollIntoView` recorded. What is asserted here is the wiring — which
 * columns are offered, what a tap scrolls to, and when the strip hides itself.
 */
let observed: string[] = [];
const scrolled: string[] = [];

beforeEach(() => {
  observed = [];
  scrolled.length = 0;
  document.body.innerHTML = '';

  class StubObserver {
    constructor(_cb: IntersectionObserverCallback) {}
    observe(node: Element) { observed.push(node.id); }
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  }
  vi.stubGlobal('IntersectionObserver', StubObserver);

  Element.prototype.scrollIntoView = function scrollIntoViewStub(this: Element) {
    scrolled.push((this as HTMLElement).id || (this as HTMLElement).dataset.chip || '');
  };
});

/** The columns the board would have rendered, which the pager scrolls to. */
const mountColumns = () => {
  for (const col of COLUMNS) {
    const node = document.createElement('div');
    node.id = domId(col.id);
    document.body.appendChild(node);
  }
};

const chips = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button[data-chip]'));

describe('BoardColumnPager', () => {
  it('offers every column with its tally', () => {
    const { container, unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    const labels = chips(container).map((c) => c.textContent?.trim());
    expect(labels).toEqual(['To Do3', 'In Progress1', 'Done0']);
    unmount();
  });

  it('scrolls the board to the column that was tapped', () => {
    mountColumns();
    const { container, unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    act(() => { (chips(container)[2] as HTMLButtonElement).click(); });
    expect(scrolled).toContain('board-col-c3');
    unmount();
  });

  it('marks the tapped column as current straight away', () => {
    // Waiting for the observer would leave the strip unanswered while a smooth
    // scroll travels, which reads as the tap having missed.
    mountColumns();
    const { container, unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    act(() => { (chips(container)[1] as HTMLButtonElement).click(); });
    expect(chips(container)[1].getAttribute('aria-current')).toBe('true');
    expect(chips(container)[0].getAttribute('aria-current')).toBeNull();
    unmount();
  });

  it('starts on the first column', () => {
    const { container, unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    expect(chips(container)[0].getAttribute('aria-current')).toBe('true');
    unmount();
  });

  it('watches each column so a flick moves the strip too', () => {
    mountColumns();
    const { unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    expect(observed).toEqual(['board-col-c1', 'board-col-c2', 'board-col-c3']);
    unmount();
  });

  it('hides itself when there is nothing to page between', () => {
    // One column is the whole board; a pager of one chip says nothing.
    const { container, unmount } = renderToDom(
      <BoardColumnPager columns={[COLUMNS[0]]} domId={domId} />
    );
    expect(container.querySelector('nav')).toBeNull();
    unmount();
  });

  it('stays out of the way on wide screens, where the columns are already visible', () => {
    const { container, unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    expect(container.querySelector('nav')?.className).toContain('sm:hidden');
    unmount();
  });

  it('names itself, since it is a second way to navigate the same board', () => {
    const { container, unmount } = renderToDom(<BoardColumnPager columns={COLUMNS} domId={domId} />);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Board columns');
    unmount();
  });
});
