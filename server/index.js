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

const rooms = new Map();

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
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.removePlayer(socket.id);
    if (room.players.length === 0) rooms.delete(roomId);
    else broadcast(room);
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
