const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const GameRoom = require('./game/GameRoom');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms      = new Map();
const onlineUsers = new Map(); // socketId → { name }

function broadcastOnlineUsers() {
  const list = [...onlineUsers.entries()].map(([sid, u]) => ({ socketId: sid, name: u.name }));
  io.emit('online_users', list);
}

function handlePlayerLeave(socketId, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const wasActive = room.phase === 'playing' || room.phase === 'endgame';
  room.removePlayer(socketId);
  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else if (wasActive && room.players.length < 2) {
    room.phase = 'abandoned';
    broadcast(room);
  } else {
    broadcast(room);
  }
}

// ── Highscore persistence ──────────────────────────────────────────────────

const SCORES_FILE = path.join(__dirname, 'highscores.json');

function loadHighscores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); }
  catch { return []; }
}

function recordGameScores(players) {
  let scores = loadHighscores();
  const now  = new Date().toISOString();
  for (const p of players) {
    if (p.score > 0) scores.push({ name: p.name, score: p.score, date: now });
  }
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 20);
  try { fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8'); } catch (_) {}
  return scores;
}

// ── Room helpers ──────────────────────────────────────────────────────────

function makeCode() {
  let code;
  do { code = Math.random().toString(36).substr(2, 4).toUpperCase(); }
  while (rooms.has(code));
  return code;
}

function broadcast(room) {
  for (const p of room.players) {
    io.to(p.id).emit('game_state', room.getStateFor(p.id));
  }
}

// ── Socket handlers ───────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log('connect', socket.id);

  // Send current online users to the newly connected socket
  socket.emit('online_users', [...onlineUsers.entries()].map(([sid, u]) => ({ socketId: sid, name: u.name })));

  socket.on('register_online', ({ name }) => {
    if (!name?.trim()) return;
    onlineUsers.set(socket.id, { name: name.trim() });
    broadcastOnlineUsers();
  });

  socket.on('leave_room', (_, cb) => {
    const roomId = socket.data.roomId;
    if (!roomId) { cb?.({ ok: true }); return; }
    handlePlayerLeave(socket.id, roomId);
    socket.data.roomId = null;
    socket.leave(roomId);
    cb?.({ ok: true });
  });

  socket.on('invite_to_room', ({ targetSocketId, roomId }) => {
    const from = onlineUsers.get(socket.id);
    if (!from) return;
    io.to(targetSocketId).emit('room_invite', { fromSocketId: socket.id, fromName: from.name, roomId });
  });

  socket.on('decline_invite', ({ fromSocketId }) => {
    const from = onlineUsers.get(socket.id);
    io.to(fromSocketId).emit('invite_declined', { byName: from?.name ?? 'Someone' });
  });

  socket.on('create_room', ({ name }, cb) => {
    try {
      const code = makeCode();
      const room = new GameRoom(code);
      rooms.set(code, room);
      room.addPlayer(socket.id, (name || '').trim() || 'Player');
      socket.join(code);
      socket.data.roomId = code;
      cb({ ok: true, roomId: code, state: room.getStateFor(socket.id) });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('join_room', ({ roomId, name }, cb) => {
    try {
      const room = rooms.get((roomId || '').toUpperCase());
      if (!room) throw new Error('Room not found');
      room.addPlayer(socket.id, (name || '').trim() || 'Player');
      socket.join(room.id);
      socket.data.roomId = room.id;
      broadcast(room);
      cb({ ok: true, state: room.getStateFor(socket.id) });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('start_game', (_, cb) => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room) throw new Error('Not in a room');
      room.startGame(socket.id);
      broadcast(room);
      cb({ ok: true });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('game_action', (action, cb) => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room) throw new Error('Not in a room');
      room.handleAction(socket.id, action);
      broadcast(room);

      // When game finishes: save scores and broadcast hall of fame
      if (room.phase === 'finished') {
        const hallOfFame = recordGameScores(room.players);
        io.to(room.id).emit('highscores', hallOfFame);
      }

      cb({ ok: true });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('get_highscores', (_, cb) => {
    try { cb({ ok: true, scores: loadHighscores() }); }
    catch { cb({ ok: true, scores: [] }); }
  });

  socket.on('chat_message', ({ text }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player || !text?.trim()) return;
    const msg = { playerId: socket.id, name: player.name, text: text.trim().slice(0, 200), ts: Date.now() };
    io.to(room.id).emit('chat_message', msg);
  });

  // ── WebRTC voice signaling ─────────────────────────────────────────────

  socket.on('voice_join', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('webrtc_signal', {
      fromId: socket.id, type: 'peer_joined', data: { peerId: socket.id }
    });
    socket.data.inVoice = true;
  });

  socket.on('voice_leave', () => { socket.data.inVoice = false; });

  socket.on('webrtc_signal', ({ targetId, type, data }) => {
    io.to(targetId).emit('webrtc_signal', { fromId: socket.id, type, data });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) handlePlayerLeave(socket.id, roomId);
    onlineUsers.delete(socket.id);
    broadcastOnlineUsers();
    console.log('disconnect', socket.id);
  });
});

// Serve built Vite client in production
const distPath = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Daketi server on :${PORT}`));
