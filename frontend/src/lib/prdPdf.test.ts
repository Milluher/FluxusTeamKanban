import { describe, expect, it } from 'vitest';
import { Prd, PrdAdminBlock, PrdApprover, User } from '@/types';
import { canExportPrd, planPrdPdf, prdFileName } from './prdPdf';

const author: User = { id: 'u1', name: 'Alice Doe', email: 'a@f.com', role: 'standard' } as User;
const other: User = { id: 'u2', name: 'Bob Roe', email: 'b@f.com', role: 'standard' } as User;
const admin: User = { id: 'u3', name: 'Femi A', email: 'f@f.com', role: 'admin' } as User;

const block = (overrides: Partial<PrdAdminBlock> = {}): PrdAdminBlock => ({
  id: 'ab1',
  prdId: 'p1',
  role: 'Compliance',
  assigneeId: 'u2',
  assignee: { id: 'u2', name: 'Bob Roe' },
  dataNeeded: null,
  actionsNeeded: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const approver = (overrides: Partial<PrdApprover> = {}): PrdApprover => ({
  id: 'ap1',
  prdId: 'p1',
  userId: 'u3',
  user: { id: 'u3', name: 'Cara Nwosu' },
  status: 'pending',
  note: null,
  decidedAt: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const prd = (overrides: Partial<Prd> = {}): Prd => ({
  id: 'p1',
  title: 'Self-serve onboarding',
  version: '0.2',
  status: 'draft',
  boardId: 'b1',
  createdById: author.id,
  createdBy: { id: author.id, name: author.name },
  board: { id: 'b1', name: 'Roadmap' },
  personas: [],
  adminBlocks: [],
  approvers: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const text = (p: Prd) => planPrdPdf(p).map((b) => b.text).join('\n');

describe('planPrdPdf metadata', () => {
  it('names the creator and the creation date, as §20 asks', () => {
    const out = text(prd());
    expect(out).toContain('Created by: Alice Doe');
    expect(out).toMatch(/Created: .*2026/);
  });

  it('lists the approvers and where each stands', () => {
    const out = text(
      prd({
        approvers: [
          approver({ status: 'approved' }),
          approver({ id: 'ap2', userId: 'u4', user: { id: 'u4', name: 'Dapo B' }, status: 'changes_requested' }),
        ],
      })
    );
    expect(out).toContain('Cara Nwosu (approved)');
    expect(out).toContain('Dapo B (changes requested)');
  });

  it('says plainly when nobody has been asked to approve', () => {
    expect(text(prd())).toContain('Approvers: none named');
  });

  it('marks a draft as unpublished rather than leaving it ambiguous', () => {
    expect(text(prd())).toContain('draft (not yet published)');
    expect(text(prd({ status: 'published', publishedAt: '2026-10-05T00:00:00.000Z' }))).toMatch(/Published: .*2026/);
  });

  it('carries the board, version and classification into the subtitle', () => {
    const out = text(prd({ classification: 'major_feature' }));
    expect(out).toContain('Roadmap');
    expect(out).toContain('v0.2');
    expect(out).toContain('Major Feature');
  });

  it('lists the target personas when there are any', () => {
    const out = text(
      prd({ personas: [{ id: 'l1', personaId: 'pe1', persona: { id: 'pe1', name: 'Smallholder farmer' } }] })
    );
    expect(out).toContain('Target personas: Smallholder farmer');
  });
});

describe('planPrdPdf sections', () => {
  it('prints a written section under its numbered heading', () => {
    const plan = planPrdPdf(prd({ overview: 'The problem.' }));
    const heading = plan.find((b) => b.kind === 'heading');
    expect(heading?.text).toBe('2. Overview and problem statement');
    expect(plan.some((b) => b.kind === 'body' && b.text === 'The problem.')).toBe(true);
  });

  it('leaves an unwritten section out rather than printing an empty heading', () => {
    const out = text(prd({ overview: 'Written.', goals: '   ' }));
    expect(out).toContain('Overview and problem statement');
    expect(out).not.toContain('3. Goals');
  });

  it('keeps the sections in the brief’s order', () => {
    const plan = planPrdPdf(prd({ successMetrics: 'Later', overview: 'Earlier' }));
    const headings = plan.filter((b) => b.kind === 'heading').map((b) => b.text);
    expect(headings).toEqual(['2. Overview and problem statement', '15. Success Metrics']);
  });
});

describe('planPrdPdf administrative and approval', () => {
  it('includes an admin block even when nobody has answered it', () => {
    const out = text(prd({ adminBlocks: [block()] }));
    expect(out).toContain('Compliance — Bob Roe');
    expect(out).toContain('Data you need: not filled in');
    expect(out).toContain('Actions you need to take: not filled in');
  });

  it('prints the answers when they exist', () => {
    const out = text(
      prd({ adminBlocks: [block({ dataNeeded: 'Transaction logs', actionsNeeded: 'Run the checks' })] })
    );
    expect(out).toContain('Data you need: Transaction logs');
    expect(out).toContain('Actions you need to take: Run the checks');
  });

  it('includes an approver’s note, since a change request without its reason is noise', () => {
    const out = text(
      prd({ approvers: [approver({ status: 'changes_requested', note: 'Tighten the scope.' })] })
    );
    expect(out).toContain('17. Approval');
    expect(out).toContain('Tighten the scope.');
  });

  it('omits the administrative heading entirely when there are no blocks', () => {
    expect(text(prd())).not.toContain('16. Administrative');
  });
});

describe('canExportPrd', () => {
  it('allows the creator', () => {
    expect(canExportPrd(prd(), author)).toBe(true);
  });

  it('allows a workspace admin', () => {
    expect(canExportPrd(prd(), admin)).toBe(true);
  });

  it('refuses anybody else, and refuses when nobody is signed in', () => {
    expect(canExportPrd(prd(), other)).toBe(false);
    expect(canExportPrd(prd(), null)).toBe(false);
  });
});

describe('prdFileName', () => {
  it('slugs the title and carries the version', () => {
    expect(prdFileName(prd())).toBe('self-serve-onboarding-v0.2.pdf');
  });

  it('copes with a title that slugs to nothing', () => {
    expect(prdFileName(prd({ title: '!!!', version: null }))).toBe('prd.pdf');
  });

  it('does not run away with a very long title', () => {
    const name = prdFileName(prd({ title: 'x'.repeat(200), version: null }));
    expect(name.length).toBeLessThanOrEqual(64);
  });
});
