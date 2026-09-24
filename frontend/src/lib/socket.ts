import { io } from 'socket.io-client';
import API_BASE_URL from './apiBase';

// The token is read through a callback rather than captured once, so a socket
// that reconnects after a re-login presents the current credentials. The
// server uses it to identify who is present on a board.
const socket = io(API_BASE_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: typeof window !== 'undefined' ? localStorage.getItem('token') : null }),
});

export default socket;
