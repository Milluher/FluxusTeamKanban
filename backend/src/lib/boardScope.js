const { PrismaClient } = require('@prisma/client');
const { canViewBoard } = require('./boardAccess');

const prisma = new PrismaClient();

/**
 * Board scoping for the four things that used to be workspace-wide: personas,
 * the dictionary, initiatives and the changelog.
 *
 * One helper rather than the same twenty lines in four routes, because the
 * interesting case is the one that is easy to get subtly different: a list
 * request with no board at all. Each of those routes used to answer "every row
 * there is" to any authenticated user, and keeping that literally would turn
 * localisation into a leak — you would see another team's personas from the
 * dashboard the moment they stopped being global.
 *
 * So "no boardId" means "every board you can already see", not "every board":
 *   - a system admin sees all of them, as they do everywhere else;
 *   - everyone else sees the boards they are a member of.
 *
 * Inside a board (?boardId=…) the answer is that board alone, and you must be
 * able to view it.
 */

/**
 * A board id out of a query string or a request body, as a string.
 *
 * Express parses `?boardId=a&boardId=b` into an array and a JSON body can hold
 * anything at all, so neither is safe to call `.trim()` on directly — that is a
 * 500 on a malformed request rather than the 400 it should be.
 */
function readBoardId(value) {
  if (Array.isArray(value)) return '';
  return typeof value === 'string' ? value.trim() : '';
}

/** The board ids a user may read. `null` means "no restriction" (system admin). */
async function visibleBoardIds(req) {
  if (req.user.role === 'admin') return null;
  const memberships = await prisma.boardMember.findMany({
    where: { userId: req.user.id },
    select: { boardId: true },
  });
  return memberships.map((m) => m.boardId);
}

/**
 * Turns `?boardId=` into a Prisma `where` fragment.
 *
 * Returns `{ where }`, or `{ status, error }` for the caller to send back —
 * rather than writing the response here, so a route can add its own filters to
 * the same object.
 */
async function listScope(req) {
  const boardId = readBoardId(req.query.boardId);

  if (boardId) {
    if (!(await canViewBoard(req, boardId))) {
      return { status: 403, error: 'You do not have access to that board' };
    }
    return { where: { boardId } };
  }

  const ids = await visibleBoardIds(req);
  if (ids === null) return { where: {} };
  // An empty membership list has to become an impossible filter, not an absent
  // one: `{ boardId: { in: [] } }` matches nothing, which is correct, whereas
  // omitting the key would match everything.
  return { where: { boardId: { in: ids } } };
}

/**
 * Validates the `boardId` a create request is asking to write into.
 *
 * `requiredMessage` is the route's own wording for a missing board, so each
 * feature can say what it means ("a persona needs a board") instead of sharing
 * one vague string.
 */
async function writeScope(req, { boardId, requiredMessage }) {
  const id = readBoardId(boardId);
  if (!id) return { status: 400, error: requiredMessage };

  const board = await prisma.board.findUnique({ where: { id }, select: { id: true } });
  if (!board) return { status: 404, error: 'That board no longer exists' };

  if (!(await canViewBoard(req, id))) {
    return { status: 403, error: 'You do not have access to that board' };
  }
  return { boardId: id };
}

module.exports = { visibleBoardIds, listScope, writeScope };
