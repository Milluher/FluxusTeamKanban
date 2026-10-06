// Renders the real card, so the F1 fix is verified where it actually matters:
// in the markup a person sees, not just in the parsing helper.
import { describe, expect, it } from 'vitest';
import { renderToHtml } from '@/test/render';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import TicketCard from './TicketCard';
import { Ticket } from '@/types';

const ticket = (description: string | null): Ticket =>
  ({ id: 't1', title: 'KYB onboarding', description, columnId: 'c1', order: 0 } as Ticket);

const render = (description: string | null) =>
  renderToHtml(
    <DndContext>
      <SortableContext items={['t1']}>
        <TicketCard ticket={ticket(description)} onClick={() => {}} />
      </SortableContext>
    </DndContext>
  );

describe('TicketCard description preview', () => {
  it('shows the text of a formatted description, not its markup', () => {
    const html = render('<p>Verify BVN</p><p>Then KYB</p>');
    expect(html).toContain('Verify BVN Then KYB');
    expect(html).not.toContain('&lt;p&gt;');
    expect(html).not.toContain('<p>Verify');
  });

  it('summarises a task list as a tally with a progress bar', () => {
    const html = render(
      '<ul data-type="taskList">' +
        '<li data-checked="true"><label><input type="checkbox" checked></label><div><p>Design</p></div></li>' +
        '<li data-checked="false"><label><input type="checkbox"></label><div><p>Build</p></div></li>' +
      '</ul>'
    );
    expect(html).toContain('1 of 2 done');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-valuemax="2"');
    // The item text is summarised, not quoted.
    expect(html).not.toContain('Design');
    expect(html).not.toContain('data-type');
  });

  it('renders no preview at all for an empty description', () => {
    const html = render('<p></p>');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('done');
  });

  it('leaks no angle brackets or entities for any description shape', () => {
    for (const description of [
      '<p>KYB</p>',
      '<h2>Heading</h2><ul><li>Item</li></ul>',
      '<p>Unclosed <b>bold',
      '&lt;p&gt;Escaped&lt;/p&gt;',
      '<ul data-type="taskList"><li data-checked="false"><div><p>Half',
      null,
    ]) {
      const html = render(description);
      // The card's own markup is fine; what must not appear is the stored HTML.
      expect(html).not.toContain('&lt;');
      expect(html).not.toContain('data-checked');
      expect(html).not.toContain('taskList');
    }
  });

  it('still renders the title and keeps the card focusable as a control', () => {
    const html = render('<p>KYB</p>');
    expect(html).toContain('KYB onboarding');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });
});

describe('TicketCard board property', () => {
  const renderWithBoard = (boardName?: string) =>
    renderToHtml(
      <DndContext>
        <SortableContext items={['t1']}>
          <TicketCard ticket={ticket('<p>Verify BVN</p>')} onClick={() => {}} boardName={boardName} />
        </SortableContext>
      </DndContext>
    );

  it('names the board when one is given, for views that mix boards together', () => {
    expect(renderWithBoard('Lending')).toContain('Lending');
  });

  it('names the sprint and its deadline when one is given', () => {
    const html = renderToHtml(
      <DndContext>
        <SortableContext items={['t1']}>
          <TicketCard
            ticket={ticket('<p>Verify BVN</p>')}
            onClick={() => {}}
            boardName="Lending"
            sprint={{ title: 'Sprint 12', endDate: '2099-10-26T00:00:00.000Z' }}
          />
        </SortableContext>
      </DndContext>
    );
    expect(html).toContain('Sprint 12');
    expect(html).toContain('Oct');
  });

  it('leaves the board off otherwise, since a board page is already the board', () => {
    const html = renderWithBoard();
    expect(html).toContain('KYB onboarding');
    expect(html).not.toContain('Lending');
  });
});
