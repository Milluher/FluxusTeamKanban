// In-memory registry of who currently has a board open.
//
// Presence is per-user, not per-socket: a user with the board open in three
// tabs appears once, and only drops off the board when their last socket goes
// away. State lives in this process only — with multiple backend instances
// each would track its own viewers, which would need a shared store (Redis
// adapter) to unify.

// boardId -> Map<userId, { id, name, since, sockets:Set<socketId>, idleSockets:Set<socketId> }>
const boards = new Map();
// socketId -> Set<boardId>, so a disconnect can clean up without a scan
const socketBoards = new Map();

function serialize(board) {
  return [...board.values()]
    .map((v) => ({
      id: v.id,
      name: v.name,
      since: v.since,
      // Someone is "active" while at least one of their tabs is visible.
      idle: v.idleSockets.size >= v.sockets.size,
    }))
    .sort((a, b) => new Date(a.since) - new Date(b.since));
}

function join(boardId, socketId, user) {
  if (!boardId || !user?.id) return null;

  if (!boards.has(boardId)) boards.set(boardId, new Map());
  const board = boards.get(boardId);

  const existing = board.get(user.id);
  if (existing) {
    existing.sockets.add(socketId);
    existing.name = user.name || existing.name;
  } else {
    board.set(user.id, {
      id: user.id,
      name: user.name || 'Someone',
      since: new Date().toISOString(),
      sockets: new Set([socketId]),
      idleSockets: new Set(),
    });
  }

  if (!socketBoards.has(socketId)) socketBoards.set(socketId, new Set());
  socketBoards.get(socketId).add(boardId);

  return serialize(board);
}

function leave(boardId, socketId) {
  const board = boards.get(boardId);
  if (!board) return null;

  for (const [userId, entry] of board) {
    if (entry.sockets.delete(socketId)) {
      entry.idleSockets.delete(socketId);
      if (entry.sockets.size === 0) board.delete(userId);
    }
  }

  socketBoards.get(socketId)?.delete(boardId);
  if (board.size === 0) boards.delete(boardId);

  return serialize(board);
}

// Returns the boards this socket was present on, so the caller can broadcast
// an update to each room it just left.
function leaveAll(socketId) {
  const joined = [...(socketBoards.get(socketId) || [])];
  const updates = joined.map((boardId) => ({ boardId, users: leave(boardId, socketId) }));
  socketBoards.delete(socketId);
  return updates;
}

// A tab reports itself hidden or visible; a user counts as idle only once
// every tab they have open is hidden.
function setIdle(boardId, socketId, idle) {
  const board = boards.get(boardId);
  if (!board) return null;

  for (const entry of board.values()) {
    if (!entry.sockets.has(socketId)) continue;
    if (idle) entry.idleSockets.add(socketId);
    else entry.idleSockets.delete(socketId);
    return serialize(board);
  }
  return null;
}

function list(boardId) {
  const board = boards.get(boardId);
  return board ? serialize(board) : [];
}

module.exports = { join, leave, leaveAll, setIdle, list };
