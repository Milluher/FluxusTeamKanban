import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColor, initials } from './avatar';

describe('initials', () => {
  it('takes the first and last word', () => {
    expect(initials('Femi Ademilua')).toBe('FA');
    expect(initials('Alice Mary Doe')).toBe('AD');
  });

  it('handles a single name, extra spaces and empty input', () => {
    expect(initials('Femi')).toBe('FE');
    expect(initials('  Femi   Ademilua  ')).toBe('FA');
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('avatarColor', () => {
  it('is stable for the same person', () => {
    expect(avatarColor('Femi Ademilua')).toBe(avatarColor('Femi Ademilua'));
  });

  it('ignores case and surrounding space, so one person is one colour', () => {
    expect(avatarColor('femi ademilua')).toBe(avatarColor('  Femi Ademilua '));
  });

  it('only ever returns a colour from the palette', () => {
    for (const name of ['Femi', 'Alice Doe', 'Bob', 'Zoë Smith', '?', 'a']) {
      expect(AVATAR_COLORS).toContain(avatarColor(name));
    }
  });

  it('spreads a realistic team across several colours', () => {
    const team = ['Femi Ademilua', 'Alice Doe', 'Bob Stone', 'Chidi Okafor', 'Dana White', 'Emeka Obi'];
    const used = new Set(team.map(avatarColor));
    // Not a guarantee of zero collisions, but a flat hash would be a bug.
    expect(used.size).toBeGreaterThan(2);
  });
});
