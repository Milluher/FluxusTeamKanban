/**
 * Autosaved drafts for a ticket being written.
 *
 * A ticket is composed in a modal, and anything that closes it — an accidental
 * click outside, a navigation, a reload — used to throw the work away. The
 * draft is kept in localStorage rather than on the server: it belongs to one
 * person at one keyboard, it is worthless to anyone else, and it has to survive
 * a reload without a round trip.
 *
 * Scoped per board, per column and per user, so two half-written tickets in
 * different columns do not overwrite each other, and a shared machine does not
 * hand one person's draft to the next.
 */

/**
 * The fields the create form owns. Dependencies are not part of a draft — they
 * reference other tickets, which may be gone by the time one is restored.
 */
export interface TicketDraft {
  title: string;
  description: string;
  assigneeId: string;
  productManagerId: string;
  assignedDate: string;
  type: string;
  priority: string;
  project: string;
  epic: string;
  flow: string;
  productDocId: string;
}

export function draftKey(boardId: string, columnId: string, userId: string | null): string {
  return `fluxus:ticketDraft:${boardId}:${columnId}:${userId ?? 'anon'}`;
}

/**
 * True when there is nothing worth keeping.
 *
 * An empty draft must not be stored: a stored blank would otherwise announce
 * "draft restored" every time the form is opened fresh.
 */
export function isDraftEmpty(draft: Partial<TicketDraft>): boolean {
  return !Object.values(draft).some((value) => typeof value === 'string' && value.trim() !== '');
}

/** Writes the draft, or removes it once it has been emptied again. */
export function writeDraft(key: string, draft: Partial<TicketDraft>): void {
  try {
    if (isDraftEmpty(draft)) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage can be full or blocked. Losing the draft is bad; failing the
    // keystroke that triggered the save is worse.
  }
}

/**
 * Reads a draft back, or null when there is none worth restoring.
 *
 * Anything unparseable is dropped rather than thrown: a corrupt draft should
 * cost an empty form, not a broken modal.
 */
export function readDraft(key: string): Partial<TicketDraft> | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    // Keep only the string fields the form knows about.
    const draft: Record<string, string> = {};
    for (const [field, value] of Object.entries(parsed)) {
      if (typeof value === 'string') draft[field] = value;
    }
    return isDraftEmpty(draft) ? null : draft;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do; a stale draft is a nuisance, not a failure.
  }
}

/** The signed-in user's id, for scoping. Null when it cannot be read. */
export function currentUserId(): string | null {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const user = JSON.parse(stored);
    return typeof user?.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}
