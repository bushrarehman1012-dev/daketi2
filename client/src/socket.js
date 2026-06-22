import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

const socket = io(SERVER_URL, { autoConnect: false });

// On reconnect, tell the server our previous socket ID so it can restore our room slot
let _lastId = null;
socket.on('connect', () => {
  const name = localStorage.getItem('daketi_name') || '';
  if (_lastId && _lastId !== socket.id) {
    socket.emit('reconnect_player', { prevSocketId: _lastId, name });
  }
  _lastId = socket.id;
});

export default socket;
