import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

// JWT token is read from localStorage at connect time so the server can link
// this socket to the authenticated user account.
function getToken() {
  return localStorage.getItem('daketi_token') || undefined;
}

const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: { token: getToken() },
});

let _lastId = null;

socket.on('connect', () => {
  // Refresh the auth token each reconnect in case user logged in/out
  socket.auth = { token: getToken() };

  const name = localStorage.getItem('daketi_name') || '';
  if (_lastId && _lastId !== socket.id) {
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
      socket.auth = { token: getToken() };
      socket.connect();
    } else if (_lastId && _lastId !== socket.id) {
      const name = localStorage.getItem('daketi_name') || '';
      socket.emit('reconnect_player', { prevSocketId: _lastId, name });
      _lastId = socket.id;
    }
  });
}

export default socket;
