import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

const socket = io(SERVER_URL, { autoConnect: false });

let _lastId = null;

socket.on('connect', () => {
  const name = localStorage.getItem('daketi_name') || '';
  if (_lastId && _lastId !== socket.id) {
    // New socket ID → tell server to restore our room slot
    socket.emit('reconnect_player', { prevSocketId: _lastId, name });
  }
  _lastId = socket.id;
});

// Heartbeat — keeps the server's lastActivity fresh so idle-cleanup doesn't fire
setInterval(() => {
  if (socket.connected) socket.emit('heartbeat');
}, 25_000);

// When the tab/app becomes visible again, ensure we're connected and
// re-send reconnect_player in case we got a new socket ID while hidden.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!socket.connected) {
      socket.connect();
    } else if (_lastId && _lastId !== socket.id) {
      // Already reconnected with a new ID but connect event may not have fired
      const name = localStorage.getItem('daketi_name') || '';
      socket.emit('reconnect_player', { prevSocketId: _lastId, name });
      _lastId = socket.id;
    }
  });
}

export default socket;
