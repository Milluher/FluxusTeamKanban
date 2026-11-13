import { describe, expect, it, vi } from 'vitest';
import { Sprint, Ticket } from '@/types';
import { chooseOption, flush, renderToDom, typeInto } from '@/test/render';
import BacklogSection from './BacklogSection';

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 't1',
  title: 'Export to CSV',
  status: 'To Do',
  columnId: 'c1',
  createdById: 'u1',
  createdBy: { id: 'u1', name: 'Alice Doe' },
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  order: 0,
  ...over,
});

const sprint = (over: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  boardId: 'b1',
  title: 'Sprint 1',
  startDate: '2026-11-01T00:00:00.000Z',
  // Far enough out that the test does not expire. The date arithmetic itself is
  // covered in lib/sprintWindow.test.ts.
  endDate: '2099-01-01T00:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
  status: 'active',
  _count: { tickets: 0, members: 0 },
  ...over,
});

const open = (
  props: Partial<React.ComponentProps<typeof BacklogSection>> = {}
) => {
  const onTicketClick = vi.fn();
  const onNewTicket = vi.fn();
  const onSchedule = vi.fn().mockResolvedValue(undefined);
  const handle = renderToDom(
    <BacklogSection
      tickets={[ticket()]}
      sprints={[sprint()]}
      isAdmin
      onTicketClick={onTicketClick}
      onNewTicket={onNewTicket}
      onSchedule={onSchedule}
      {...props}
    />
  );
  return { ...handle, onTicketClick, onNewTicket, onSchedule };
};

const picker = (container: HTMLElement) =>
  container.querySelector('select') as HTMLSelectElement | null;

describe('BacklogSection', () => {
  it('lists what is waiting, and who raised it', async () => {
    const { container, unmount } = open();
    await flush();
    expect(container.textContent).toContain('Export to CSV');
    expect(container.textContent).toContain('Raised by Alice Doe');
    unmount();
  });

  it('offers no way to assign a backlog ticket to anybody', async () => {
    // The whole point of the backlog: scheduling comes before assignment, so
    // there is no assignee control here at all — not a disabled one.
    const { container, unmount } = open();
    await flush();
    expect(container.textContent).not.toContain('Assignee');
    expect(picker(container)?.getAttribute('aria-label')).toContain('Schedule');
    unmount();
  });

  it('offers only the sprints that have not ended or been completed', async () => {
    const { container, unmount } = open({
      sprints: [
        sprint({ id: 'live', title: 'Live sprint' }),
        sprint({ id: 'past', title: 'Ended sprint', endDate: '2026-01-01T00:00:00.000Z' }),
        sprint({ id: 'done', title: 'Finished sprint', status: 'completed' }),
      ],
    });
    await flush();
    const options = Array.from(picker(container)!.options).map((o) => o.value);
    expect(options).toEqual(['', 'live']);
    unmount();
  });

  it('schedules a ticket into the sprint that was picked', async () => {
    const { container, onSchedule, unmount } = open();
    await flush();
    chooseOption(picker(container)!, 's1');
    await flush();
    expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 's1');
    unmount();
  });

  it('shows the reason a schedule was refused rather than failing silently', async () => {
    const onSchedule = vi
      .fn()
      .mockRejectedValue({ response: { data: { error: '"Sprint 1" has already ended' } } });
    const { container, unmount } = open({ onSchedule });
    await flush();
    chooseOption(picker(container)!, 's1');
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already ended');
    unmount();
  });

  it('tells an admin with no open sprint to make one, instead of an empty picker', async () => {
    const { container, unmount } = open({ sprints: [sprint({ status: 'completed' })] });
    await flush();
    expect(picker(container)).toBeNull();
    expect(container.textContent).toContain('No open sprint to schedule into');
    unmount();
  });

  it('keeps scheduling to admins', async () => {
    const { container, unmount } = open({ isAdmin: false });
    await flush();
    expect(picker(container)).toBeNull();
    expect(container.textContent).not.toContain('No open sprint');
    unmount();
  });

  it('says what the backlog is for when it is empty', async () => {
    const { container, unmount } = open({ tickets: [] });
    await flush();
    expect(container.textContent).toContain('Nothing in the backlog');
    unmount();
  });

  it('distinguishes a search that matched nothing from an empty backlog', async () => {
    // Two identical-looking empty lists with different fixes: one needs a
    // ticket raising, the other needs the search clearing.
    const { container, unmount } = open({ tickets: [ticket(), ticket({ id: 't2', title: 'Bulk import' })] });
    await flush();
    typeInto(container.querySelector('input[type="search"]') as HTMLInputElement, 'nothing here');
    await flush();
    expect(container.textContent).toContain('No backlog ticket matches');
    expect(container.textContent).not.toContain('Nothing in the backlog');
    unmount();
  });

  it('filters the list down to what matches', async () => {
    const { container, unmount } = open({ tickets: [ticket(), ticket({ id: 't2', title: 'Bulk import' })] });
    await flush();
    typeInto(container.querySelector('input[type="search"]') as HTMLInputElement, 'bulk');
    await flush();
    expect(container.textContent).toContain('Bulk import');
    expect(container.textContent).not.toContain('Export to CSV');
    unmount();
  });

  it('opens a ticket when its title is clicked', async () => {
    const { container, onTicketClick, unmount } = open();
    await flush();
    const title = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export to CSV')
    )!;
    title.click();
    await flush();
    expect(onTicketClick).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    unmount();
  });
});

describe('BacklogSection — tasks a PRD raised', () => {
  it('names the owner of a ticket that arrived already assigned', async () => {
    // Publishing a PRD hands its blocks and approvals straight to named people,
    // with no sprint — so they land here owned. A list implying nothing here is
    // owned would be lying about them.
    const { container, unmount } = open({
      tickets: [
        ticket({
          title: 'Self-serve onboarding — Compliance',
          assigneeId: 'u2',
          assignee: { id: 'u2', name: 'Bob Roe', email: 'b@f.com', role: 'standard' },
        }),
      ],
    });
    await flush();
    expect(container.textContent).toContain('Bob Roe');
    unmount();
  });
});
