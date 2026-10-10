import { Prd, User } from '@/types';
import { PRD_CLASSIFICATIONS, PRD_SECTIONS } from '@/lib/prdSections';

/**
 * Turning a PRD into a PDF, in two halves.
 *
 * `planPrdPdf` decides *what* the document says and in what order; the renderer
 * below decides how it looks on a page. Splitting them means the part with the
 * rules — which sections appear, what the metadata says, how an unanswered
 * block reads — can be tested without a PDF library or a canvas.
 */

export type PdfBlockKind = 'title' | 'subtitle' | 'meta' | 'heading' | 'subheading' | 'body';

export interface PdfBlock {
  kind: PdfBlockKind;
  text: string;
}

const APPROVAL_LABEL: Record<string, string> = {
  pending: 'pending',
  approved: 'approved',
  changes_requested: 'changes requested',
};

/** A date a reader can check against, rather than a relative "2 days ago". */
function fullDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * §19 and §20: the document, and the metadata a reader needs to trust it —
 * who wrote it, when, and who signed it off.
 */
export function planPrdPdf(prd: Prd): PdfBlock[] {
  const blocks: PdfBlock[] = [{ kind: 'title', text: prd.title }];

  const classification = PRD_CLASSIFICATIONS.find((c) => c.value === prd.classification);
  const subtitle = [prd.board.name, prd.version ? `v${prd.version}` : null, classification?.label]
    .filter(Boolean)
    .join(' · ');
  if (subtitle) blocks.push({ kind: 'subtitle', text: subtitle });

  // §20 metadata.
  blocks.push({ kind: 'meta', text: `Created by: ${prd.createdBy.name}` });
  const created = fullDate(prd.createdAt);
  if (created) blocks.push({ kind: 'meta', text: `Created: ${created}` });
  const publishedAt = fullDate(prd.publishedAt);
  blocks.push({
    kind: 'meta',
    text: publishedAt ? `Published: ${publishedAt}` : 'Status: draft (not yet published)',
  });

  if (prd.approvers.length > 0) {
    const roster = prd.approvers
      .map((a) => `${a.user.name} (${APPROVAL_LABEL[a.status] ?? a.status})`)
      .join(', ');
    blocks.push({ kind: 'meta', text: `Approvers: ${roster}` });
  } else {
    blocks.push({ kind: 'meta', text: 'Approvers: none named' });
  }

  if (prd.personas.length > 0) {
    blocks.push({
      kind: 'meta',
      text: `Target personas: ${prd.personas.map((p) => p.persona.name).join(', ')}`,
    });
  }

  // The sections, in the brief's order. An unwritten one is left out rather
  // than printed as an empty heading — a PDF is read, not filled in.
  for (const section of PRD_SECTIONS) {
    const value = prd[section.name];
    if (typeof value !== 'string' || value.trim() === '') continue;
    blocks.push({ kind: 'heading', text: `${section.number}. ${section.label}` });
    blocks.push({ kind: 'body', text: value.trim() });
  }

  // §16. Included even when unanswered, because who owes what is part of the
  // document — and the brief is explicit that an empty block still shows.
  if (prd.adminBlocks.length > 0) {
    blocks.push({ kind: 'heading', text: '16. Administrative' });
    for (const block of prd.adminBlocks) {
      blocks.push({ kind: 'subheading', text: `${block.role} — ${block.assignee.name}` });
      blocks.push({ kind: 'body', text: `Data you need: ${block.dataNeeded?.trim() || 'not filled in'}` });
      blocks.push({
        kind: 'body',
        text: `Actions you need to take: ${block.actionsNeeded?.trim() || 'not filled in'}`,
      });
    }
  }

  // §17, with any notes, since a change request without its reason is noise.
  if (prd.approvers.length > 0) {
    blocks.push({ kind: 'heading', text: '17. Approval' });
    for (const approver of prd.approvers) {
      const decided = fullDate(approver.decidedAt);
      blocks.push({
        kind: 'subheading',
        text: `${approver.user.name} — ${APPROVAL_LABEL[approver.status] ?? approver.status}${decided ? ` (${decided})` : ''}`,
      });
      if (approver.note?.trim()) blocks.push({ kind: 'body', text: approver.note.trim() });
    }
  }

  return blocks;
}

/** §19: its creator, or a workspace admin. */
export function canExportPrd(prd: Prd, user?: User | null): boolean {
  if (!user) return false;
  return prd.createdById === user.id || user.role === 'admin';
}

/** A filename that sorts and reads sensibly in a downloads folder. */
export function prdFileName(prd: Prd): string {
  const slug = prd.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'prd';
  return `${slug}${prd.version ? `-v${prd.version}` : ''}.pdf`;
}

const STYLES: Record<PdfBlockKind, { size: number; bold: boolean; gapBefore: number; gapAfter: number }> = {
  title: { size: 20, bold: true, gapBefore: 0, gapAfter: 3 },
  subtitle: { size: 11, bold: false, gapBefore: 0, gapAfter: 5 },
  meta: { size: 9, bold: false, gapBefore: 0, gapAfter: 1.5 },
  heading: { size: 13, bold: true, gapBefore: 7, gapAfter: 2.5 },
  subheading: { size: 10.5, bold: true, gapBefore: 4, gapAfter: 2 },
  body: { size: 10, bold: false, gapBefore: 0, gapAfter: 3.5 },
};

/**
 * Renders the plan and hands the reader a file.
 *
 * jsPDF is imported here rather than at module scope so it is not in the
 * bundle everyone downloads — only the person who actually exports pays for it.
 */
export async function downloadPrdPdf(prd: Prd): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  for (const block of planPrdPdf(prd)) {
    const style = STYLES[block.kind];
    y += style.gapBefore;
    doc.setFontSize(style.size);
    doc.setFont('helvetica', style.bold ? 'bold' : 'normal');

    // Paragraph breaks in a section have to survive into the PDF, so each is
    // wrapped on its own rather than the whole block being flattened.
    const paragraphs = block.text.split(/\n{2,}/);
    paragraphs.forEach((paragraph, index) => {
      const lines = doc.splitTextToSize(paragraph.replace(/\n/g, ' '), maxWidth);
      const lineHeight = style.size * 0.45;
      for (const line of lines) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      if (index < paragraphs.length - 1) y += lineHeight * 0.5;
    });

    y += style.gapAfter;
  }

  doc.save(prdFileName(prd));
}
