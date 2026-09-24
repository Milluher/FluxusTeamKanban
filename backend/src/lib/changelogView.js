// Shaping rules for changelog entries.
//
// Every user can see every published entry, across every project. Detail is
// what's scoped: an entry attached to a board is listed for everyone, but its
// items are only spelled out for that board's members. Admins see everything,
// drafts included.

const ITEM_KINDS = ['added', 'changed', 'fixed', 'removed'];

// Accepts [{ kind, text }] and drops anything malformed rather than failing the
// request — the editor is the only writer, but the column is free-form JSON.
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => ({
      kind: ITEM_KINDS.includes(i?.kind) ? i.kind : 'changed',
      text: typeof i?.text === 'string' ? i.text.trim() : '',
    }))
    .filter((i) => i.text.length > 0);
}

function presentEntry(entry, { isAdmin, memberBoardIds }) {
  const base = {
    id: entry.id,
    version: entry.version,
    title: entry.title,
    boardId: entry.boardId,
    board: entry.board ? { id: entry.board.id, name: entry.board.name } : null,
    author: entry.author ? { id: entry.author.id, name: entry.author.name } : null,
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };

  const items = normalizeItems(entry.items);
  const detailed = isAdmin || !entry.boardId || memberBoardIds.has(entry.boardId);

  if (detailed) {
    return { ...base, summary: entry.summary, items, restricted: false, itemCount: items.length };
  }
  return { ...base, summary: null, items: [], restricted: true, itemCount: items.length };
}

module.exports = { ITEM_KINDS, normalizeItems, presentEntry };
