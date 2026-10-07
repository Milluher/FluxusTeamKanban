import { Prd } from '@/types';

/**
 * The PRD's sections, in the brief's order, with its numbering kept so the form
 * and the document it came from can be read side by side.
 *
 * The brief's duplicates are merged: §3 asks for goals and §15 for the metrics,
 * rather than §3 asking for both and §15 asking again; and acceptance criteria
 * belong to §14 alone rather than also hiding inside §5. An author who meets
 * the same question twice does not know which box to use.
 */
export interface PrdSection {
  /** The field on the PRD. */
  name: keyof Prd & string;
  /** The brief's section number, shown so the two can be cross-read. */
  number: number;
  label: string;
  /** What the section is for, in the brief's words where it gave them. */
  hint?: string;
  /** Required before publishing — never to save a draft. */
  required?: boolean;
  rows: number;
}

export const PRD_SECTIONS: PrdSection[] = [
  {
    name: 'overview',
    number: 2,
    label: 'Overview and problem statement',
    hint: "What problem you're solving, for whom, and why now.",
    required: true,
    rows: 5,
  },
  {
    name: 'goals',
    number: 3,
    label: 'Goals',
    hint: 'The outcomes you want. The measurable KPIs live in Success Metrics.',
    required: true,
    rows: 4,
  },
  {
    name: 'userStories',
    number: 4,
    label: 'User stories and use cases',
    hint: 'The scenarios the product must support — "As a [user], I want [action] so that [benefit]".',
    rows: 5,
  },
  {
    name: 'functionalReqs',
    number: 5,
    label: 'Functional requirements',
    hint: 'The features and behaviours, prioritised (P0/P1/P2 or MoSCoW).',
    rows: 5,
  },
  {
    name: 'nonFunctionalReqs',
    number: 6,
    label: 'Non-functional requirements',
    hint: 'Performance, security, compliance, scalability, accessibility, availability.',
    rows: 4,
  },
  {
    name: 'userFlows',
    number: 7,
    label: 'User flows and design',
    hint: 'Wireframes, mockups, or links to design files.',
    rows: 3,
  },
  {
    name: 'assumptions',
    number: 8,
    label: 'Assumptions, constraints and dependencies',
    hint: 'Technical, regulatory, third-party or team dependencies.',
    rows: 4,
  },
  { name: 'platforms', number: 9, label: 'Platforms', rows: 2 },
  { name: 'inScope', number: 12, label: 'In-Scope', required: true, rows: 4 },
  { name: 'outOfScope', number: 13, label: 'Out-of-Scope', required: true, rows: 4 },
  { name: 'acceptanceCriteria', number: 14, label: 'Acceptance Criteria', required: true, rows: 4 },
  {
    name: 'successMetrics',
    number: 15,
    label: 'Success Metrics',
    hint: 'The measurable KPIs that show the goals were met.',
    required: true,
    rows: 4,
  },
];

export const PRD_CLASSIFICATIONS = [
  { value: 'new_product', label: 'New Product' },
  { value: 'major_feature', label: 'Major Feature' },
  { value: 'minor_enhancement', label: 'Minor Enhancement' },
] as const;

/**
 * Which required sections are still blank.
 *
 * Mirrors the server, which is authoritative — this exists so the form can say
 * what is missing before asking, rather than only after being refused.
 */
export function missingBeforePublish(prd: Partial<Prd>): PrdSection[] {
  return PRD_SECTIONS.filter((s) => {
    if (!s.required) return false;
    const value = prd[s.name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

/** How complete a PRD reads, for a progress hint on a draft. */
export function sectionsFilled(prd: Partial<Prd>): number {
  return PRD_SECTIONS.filter((s) => {
    const value = prd[s.name];
    return typeof value === 'string' && value.trim() !== '';
  }).length;
}
