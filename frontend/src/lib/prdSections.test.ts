import { describe, expect, it } from 'vitest';
import { Prd } from '@/types';
import { PRD_SECTIONS, missingBeforePublish, sectionsFilled } from './prdSections';

const filled = (fields: Partial<Prd>): Partial<Prd> => fields;

describe('PRD_SECTIONS', () => {
  it('asks each of the brief’s questions exactly once', () => {
    const names = PRD_SECTIONS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    const numbers = PRD_SECTIONS.map((s) => s.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('keeps goals and success metrics apart, rather than asking for both twice', () => {
    const goals = PRD_SECTIONS.find((s) => s.name === 'goals')!;
    const metrics = PRD_SECTIONS.find((s) => s.name === 'successMetrics')!;
    expect(goals.label).toBe('Goals');
    expect(metrics.label).toBe('Success Metrics');
    // The merge is the point: neither label should claim the other's content.
    expect(goals.label).not.toMatch(/metric/i);
    expect(metrics.label).not.toMatch(/goal/i);
  });

  it('gives acceptance criteria one home, not two', () => {
    const functional = PRD_SECTIONS.find((s) => s.name === 'functionalReqs')!;
    expect(functional.label).toBe('Functional requirements');
    expect(functional.hint ?? '').not.toMatch(/acceptance criteria/i);
    expect(PRD_SECTIONS.filter((s) => /acceptance criteria/i.test(s.label))).toHaveLength(1);
  });

  it('marks exactly the sections the brief calls required', () => {
    expect(PRD_SECTIONS.filter((s) => s.required).map((s) => s.name)).toEqual([
      'overview',
      'goals',
      'inScope',
      'outOfScope',
      'acceptanceCriteria',
      'successMetrics',
    ]);
  });

  it('runs in the brief’s order', () => {
    const numbers = PRD_SECTIONS.map((s) => s.number);
    expect([...numbers]).toEqual([...numbers].sort((a, b) => a - b));
  });
});

describe('missingBeforePublish', () => {
  const complete = filled({
    overview: 'The problem.',
    goals: 'The outcome.',
    inScope: 'This.',
    outOfScope: 'Not that.',
    acceptanceCriteria: 'Given/when/then.',
    successMetrics: 'Activation up 10%.',
  });

  it('is satisfied by the required sections alone', () => {
    expect(missingBeforePublish(complete)).toEqual([]);
  });

  it('names what is blank, and only the required ones', () => {
    const names = missingBeforePublish({ ...complete, goals: '', userStories: '' }).map((s) => s.name);
    expect(names).toEqual(['goals']);
  });

  it('counts whitespace as blank, so spaces cannot publish a PRD', () => {
    const names = missingBeforePublish({ ...complete, overview: '   ' }).map((s) => s.name);
    expect(names).toEqual(['overview']);
  });

  it('reports every required section for an untouched draft', () => {
    expect(missingBeforePublish({}).map((s) => s.name)).toEqual([
      'overview',
      'goals',
      'inScope',
      'outOfScope',
      'acceptanceCriteria',
      'successMetrics',
    ]);
  });
});

describe('sectionsFilled', () => {
  it('counts only written sections', () => {
    expect(sectionsFilled({})).toBe(0);
    expect(sectionsFilled({ overview: 'x', platforms: ' ' })).toBe(1);
  });

  it('tops out at the number of sections there are', () => {
    const everything: Record<string, string> = {};
    for (const s of PRD_SECTIONS) everything[s.name] = 'written';
    expect(sectionsFilled(everything as Partial<Prd>)).toBe(PRD_SECTIONS.length);
  });
});
