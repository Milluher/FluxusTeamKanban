import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDraft,
  currentUserId,
  draftKey,
  isDraftEmpty,
  readDraft,
  writeDraft,
} from './ticketDraft';

const key = draftKey('b1', 'c1', 'u1');

describe('draftKey', () => {
  it('separates boards, columns and people, so drafts cannot overwrite each other', () => {
    expect(draftKey('b1', 'c1', 'u1')).not.toEqual(draftKey('b1', 'c2', 'u1'));
    expect(draftKey('b1', 'c1', 'u1')).not.toEqual(draftKey('b2', 'c1', 'u1'));
    expect(draftKey('b1', 'c1', 'u1')).not.toEqual(draftKey('b1', 'c1', 'u2'));
  });

  it('still produces a usable key when the user cannot be identified', () => {
    expect(draftKey('b1', 'c1', null)).toContain('anon');
  });
});

describe('isDraftEmpty', () => {
  it('treats whitespace as empty, so a stray space is not a draft', () => {
    expect(isDraftEmpty({ title: '   ', description: '' })).toBe(true);
    expect(isDraftEmpty({})).toBe(true);
  });

  it('counts any filled field, not just the title', () => {
    expect(isDraftEmpty({ title: '', priority: 'high' })).toBe(false);
  });
});

describe('writeDraft / readDraft', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a draft', () => {
    writeDraft(key, { title: 'KYB onboarding', priority: 'high' });
    expect(readDraft(key)).toEqual({ title: 'KYB onboarding', priority: 'high' });
  });

  it('stores nothing for an empty draft, so a fresh form does not claim a restore', () => {
    writeDraft(key, { title: '  ' });
    expect(localStorage.getItem(key)).toBeNull();
    expect(readDraft(key)).toBeNull();
  });

  it('removes a stored draft once the form has been emptied again', () => {
    writeDraft(key, { title: 'Something' });
    writeDraft(key, { title: '' });
    expect(readDraft(key)).toBeNull();
  });

  it('drops a corrupt draft rather than throwing', () => {
    localStorage.setItem(key, '{not json');
    expect(readDraft(key)).toBeNull();
  });

  it('ignores non-string fields that were never ours', () => {
    localStorage.setItem(key, JSON.stringify({ title: 'Real', deps: [1, 2], count: 3 }));
    expect(readDraft(key)).toEqual({ title: 'Real' });
  });

  it('survives storage being unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeDraft(key, { title: 'x' })).not.toThrow();
    setItem.mockRestore();

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDraft(key)).toBeNull();
    getItem.mockRestore();
  });

  it('clears on request', () => {
    writeDraft(key, { title: 'Gone soon' });
    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });
});

describe('currentUserId', () => {
  beforeEach(() => localStorage.clear());

  it('reads the signed-in user', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u9', name: 'Alice' }));
    expect(currentUserId()).toBe('u9');
  });

  it('returns null when there is nobody, or the record is junk', () => {
    expect(currentUserId()).toBeNull();
    localStorage.setItem('user', 'not json');
    expect(currentUserId()).toBeNull();
    localStorage.setItem('user', JSON.stringify({ name: 'no id' }));
    expect(currentUserId()).toBeNull();
  });
});
