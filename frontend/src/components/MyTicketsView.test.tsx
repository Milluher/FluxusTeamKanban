import { describe, expect, it, vi } from 'vitest';
import { AssignedTicket } from '@/types';
import { renderToDom } from '@/test/render';
import MyTicketsView from './MyTicketsView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ticket = (overrides: Partial<AssignedTicket> = {}): AssignedTicket =>
  ({
    id: 't1',
    title: 'KYB onboarding',
    description: '<p>Verify BVN</p>',
    columnId: 'c1',
    order: 0,
    status: 'todo',
    createdById: 'u1',
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: { id: 'u1', name: 'Alice' },
    column: { id: 'c1', name: 'In Progress', board: { id: 'b1', name: 'Lending', type: 'sprint' } },
    ...overrides,
  } as AssignedTicket);

describe('MyTicketsView', () => {
  it('groups tickets under the board they live on', () => {
    const { container, unmount } = renderToDom(
      <MyTicketsView
        loading={false}
        onShowBoards={vi.fn()}
        tickets={[
          ticket(),
          ticket({ id: 't2', title: 'Payout retries', column: { id: 'c9', name: 'To Do', board: { id: 'b2', name: 'Payments', type: 'kanban' } } } as Partial<AssignedTicket>),
        ]}
      />
    );
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual(['Lending', 'Payments']);
    unmount();
  });

  it('links each ticket straight to itself on its board', () => {
    const { container, unmount } = renderToDom(
      <MyTicketsView loading={false} onShowBoards={vi.fn()} tickets={[ticket()]} />
    );
    const link = container.querySelector('a[href="/board/b1?ticket=t1"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('KYB onboarding');
    unmount();
  });

  it('shows the column a ticket sits in, and its description as text', () => {
    const { container, unmount } = renderToDom(
      <MyTicketsView loading={false} onShowBoards={vi.fn()} tickets={[ticket()]} />
    );
    expect(container.textContent).toContain('In Progress');
    expect(container.textContent).toContain('Verify BVN');
    expect(container.innerHTML).not.toContain('&lt;p&gt;');
    unmount();
  });

  it('summarises a checklist description rather than quoting it', () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-checked="true"><label><input type="checkbox" checked></label><div><p>One</p></div></li>' +
      '<li data-checked="false"><label><input type="checkbox"></label><div><p>Two</p></div></li>' +
      '</ul>';
    const { container, unmount } = renderToDom(
      <MyTicketsView loading={false} onShowBoards={vi.fn()} tickets={[ticket({ description: html })]} />
    );
    expect(container.textContent).toContain('1 of 2 done');
    expect(container.textContent).not.toContain('One');
    unmount();
  });

  it('offers a way to the boards when nothing is assigned', () => {
    const onShowBoards = vi.fn();
    const { container, unmount } = renderToDom(
      <MyTicketsView loading={false} onShowBoards={onShowBoards} tickets={[]} />
    );
    expect(container.textContent).toContain('Nothing assigned to you');
    const button = container.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(onShowBoards).toHaveBeenCalled();
    unmount();
  });

  it('says it is loading rather than claiming you have no work', () => {
    const { container, unmount } = renderToDom(
      <MyTicketsView loading onShowBoards={vi.fn()} tickets={[]} />
    );
    expect(container.textContent).toContain('Loading your tickets');
    expect(container.textContent).not.toContain('Nothing assigned');
    unmount();
  });
});
