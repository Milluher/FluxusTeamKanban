const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const ticketRoutes = require('./routes/tickets');
const commentRoutes = require('./routes/comments');
const userRoutes = require('./routes/users');
const invitationRoutes = require('./routes/invitations');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const canvasRoutes = require('./routes/canvas');
const productFileRoutes = require('./routes/productFiles');
const changelogRoutes = require('./routes/changelog');
const presence = require('./lib/presence');
const { JWT_SECRET } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://fluxusteamkanban.vercel.app',
  'https://fluxusteamkanban-staging.up.railway.app',
];

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Attach io to req
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/boards', canvasRoutes);
app.use('/api/boards', productFileRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api', invitationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/changelog', changelogRoutes);

// Display names aren't in the JWT, and presence needs one per connection —
// cache them so repeated connects don't re-query for the same user.
const nameCache = new Map();

async function resolveUser(token) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (nameCache.has(payload.id)) return { id: payload.id, name: nameCache.get(payload.id) };

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true },
  });
  if (!user) return null;
  nameCache.set(user.id, user.name);
  return user;
}

// Identify the socket if it presents a valid token. Connections without one are
// still allowed — they simply don't appear in presence.
io.use(async (socket, next) => {
  // A failure here must never block the connection: without this guard a
  // database hiccup would reject every socket and take real-time updates
  // down with it. The socket just connects unidentified (no presence).
  try {
    socket.data.user = await resolveUser(socket.handshake.auth?.token);
  } catch (e) {
    console.error('[presence] could not identify socket:', e?.message || e);
    socket.data.user = null;
  }
  next();
});

io.on('connection', (socket) => {
  const broadcastPresence = (boardId, users) => {
    if (users) io.to(`board:${boardId}`).emit('presence-update', { boardId, users });
  };

  socket.on('join-board', (boardId) => {
    socket.join(`board:${boardId}`);
    // Join the room first so the broadcast reaches this socket too.
    broadcastPresence(boardId, presence.join(boardId, socket.id, socket.data.user));
  });

  socket.on('leave-board', (boardId) => {
    const users = presence.leave(boardId, socket.id);
    socket.leave(`board:${boardId}`);
    broadcastPresence(boardId, users);
  });

  // A tab reporting itself hidden or visible, so the tracker can separate
  // "here right now" from "left the tab open".
  socket.on('board-activity', ({ boardId, idle }) => {
    broadcastPresence(boardId, presence.setIdle(boardId, socket.id, !!idle));
  });

  socket.on('join-user', (userId) => socket.join(`user:${userId}`));
  socket.on('leave-user', (userId) => socket.leave(`user:${userId}`));

  socket.on('disconnect', () => {
    for (const { boardId, users } of presence.leaveAll(socket.id)) {
      broadcastPresence(boardId, users);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
