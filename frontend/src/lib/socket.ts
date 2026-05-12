import { io } from 'socket.io-client';

const socket = io('https://fluxusteamkanban-staging.up.railway.app', { autoConnect: false });
export default socket;
