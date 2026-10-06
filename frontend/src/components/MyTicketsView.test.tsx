import { describe, expect, it, vi } from 'vitest';
import { AssignedTicket, Board } from '@/types';
import { renderToDom } from '@/test/render';
import MyTicketsView from './MyTicketsView';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ticket = (overrides: Partial<AssignedTicket> = {}): AssignedTicket =>
  ({
    id: 't1',
    title: 'KYB onboarding',
    description: '<p>Verify BVN</p>',
    columnId: 'c1',
    order: 0,
    status: 'In Progress',
    createdById: 'u1',
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: { id: 'u1', name: 'Alice' },
    column: { id: 'c1', name: 'In Progress', board: { id: 'b1', name: 'Lending', type: 'sprint' } },
    ...overrides,
  } as AssignedTicket);

const board = (id: string, name: string, columns: string[], type = 'sprint'): Board =>
  ({
    id,
    name,
    type,
    columns: columns.map((c, i) => ({ id: `${id}-${c}`, name: c, order: i, boardId: id, tickets: [] })),
    members: [],
  } as Board);

const boards = [
  board('b1', 'Lending', ['Backlog', 'To Do', 'In Progress', 'Review', 'Done']),
  board('b2', 'Payments', ['To Do', 'In Progress', 'Done'], 'kanban'),
];

const view = (props: Partial<React.ComponentProps<typeof MyTicketsView>> = {}) => (
  <MyTicketsView
    loading={false}
    boards={boards}
    tickets={[ticket()]}
    onShowBoards={vi.fn()}
    onMove={vi.fn()}
    {...props}
  />
);

describe('MyTicketsView', () => {
  it('lays the tickets out as columns of statuses, not sections of boards', () => {
    const { container, unmount } = renderToDom(
      view({
        tickets: [
          ticket(),
          ticket({
            id: 't2',
            title: 'Payout retries',
            column: { id: 'c9', name: 'To Do', board: { id: 'b2', name: 'Payments', type: 'kanban' } },
          } as Partial<AssignedTicket>),
        ],
      })
    );
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual(['Backlog', 'To Do', 'In Progress', 'Review', 'Done']);
    unmount();
  });

  it('names the board each ticket was created on, since the columns no longer do', () => {
    const { container, unmount } = renderToDom(
      view({
        tickets: [
          ticket(),
          ticket({
            id: 't2',
            title: 'Payout retries',
            column: { id: 'c9', name: 'To Do', board: { id: 'b2', name: 'Payments', type: 'kanban' } },
          } as Partial<AssignedTicket>),
        ],
      })
    );
    expect(container.textContent).toContain('Lending');
    expect(container.textContent).toContain('Payments');
    unmount();
  });

  it('counts the tickets in each column', () => {
    const { container, unmount } = renderToDom(
      view({ tickets: [ticket(), ticket({ id: 't2', title: 'Second' } as Partial<AssignedTicket>)] })
    );
    const inProgress = Array.from(container.querySelectorAll('h2')).find((h) => h.textContent === 'In Progress');
    expect(inProgress?.parentElement?.textContent).toContain('2');
    unmount();
  });

  it('opens a ticket on its own board when its card is clicked', () => {
    push.mockClear();
    const { container, unmount } = renderToDom(view());
    // A card is a draggable, which dnd-kit exposes as role="button".
    const card = Array.from(container.querySelectorAll<HTMLDivElement>('div[role="button"]')).find(
      (el) => el.textContent?.includes('KYB onboarding')
    );
    card!.click();
    expect(push).toHaveBeenCalledWith('/board/b1?ticket=t1');
    unmount();
  });

  it('shows a description as text rather than its markup', () => {
    const { container, unmount } = renderToDom(view());
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
    const { container, unmount } = renderToDom(view({ tickets: [ticket({ description: html })] }));
    expect(container.textContent).toContain('1 of 2 done');
    expect(container.textContent).not.toContain('One');
    unmount();
  });

  it('offers a way to the boards when nothing is assigned', () => {
    const onShowBoards = vi.fn();
    const { container, unmount } = renderToDom(view({ tickets: [], onShowBoards }));
    expect(container.textContent).toContain('Nothing assigned to you');
    const button = container.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(onShowBoards).toHaveBeenCalled();
    unmount();
  });

  it('says it is loading rather than claiming you have no work', () => {
    const { container, unmount } = renderToDom(view({ loading: true, tickets: [] }));
    expect(container.textContent).toContain('Loading your tickets');
    expect(container.textContent).not.toContain('Nothing assigned');
    unmount();
  });
});
