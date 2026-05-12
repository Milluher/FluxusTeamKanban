import { io } from 'socket.io-client';

const socket = io('https://yamabiko.proxy.rlwy.net:13375', { autoConnect: false });
export default socket;
