const express = require('express');
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

const app = express();
const server = http.createServer(app);

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

io.on('connection', (socket) => {
  socket.on('join-board', (boardId) => socket.join(`board:${boardId}`));
  socket.on('leave-board', (boardId) => socket.leave(`board:${boardId}`));
  socket.on('join-user', (userId) => socket.join(`user:${userId}`));
  socket.on('leave-user', (userId) => socket.leave(`user:${userId}`));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
