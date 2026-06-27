const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const jwt      = require('jsonwebtoken');
const GameRoom = require('./game/GameRoom');
const { router: authRouter, JWT_SECRET } = require('./routes/auth');
const socialRouter = require('./routes/social');
const { users, games } = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  pingInterval: 25000,
  pingTimeout:  120000, // 2 min — mobile browsers can pause JS longer than 60s
});

app.use(cors());
app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth',    authRouter);
app.use('/api/friends', socialRouter);
app.use('/api/history', socialRouter);

const rooms        = new Map();
const onlineUsers  = new Map(); // socketId → { name, userId? }
const reconnectBuf = new Map(); // socketId → { roomId, name, userId?, timer }
const roomGames    = new Map(); // roomId → gameId (active DB game record)

// Timeout constants — all in milliseconds, easy to tune
const RECONNECT_MS    = 3 * 60 * 1000;  // 3 min — grace window before treating disconnect as a leave
const IDLE_CLEANUP_MS = 15 * 60 * 1000; // 15 min — destroy room after all players gone this long

// Periodic idle-room cleanup: runs every 5 min, deletes rooms where every player
// has been disconnected (not in onlineUsers, not in reconnectBuf) for 15+ minutes.
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (!room.lastActivity) { room.lastActivity = now; continue; }
    const anyAlive = room.players.some(p => onlineUsers.has(p.id) || reconnectBuf.has(p.id));
    if (!anyAlive && now - room.lastActivity > IDLE_CLEANUP_MS) {
      console.log('idle-room cleanup', roomId);
      rooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

function broadcastOnlineUsers() {
  const list = [...onlineUsers.entries()].map(([sid, u]) => ({ socketId: sid, name: u.name }));
  io.emit('online_users', list);
}

function handlePlayerLeave(socketId, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const wasActive = room.phase === 'playing' || room.phase === 'endgame';
  room.removePlayer(socketId);
  // If no human players remain (e.g. human left a vs-bot room), destroy the room
  const humans = room.players.filter(p => !p.isBot);
  if (humans.length === 0) {
    rooms.delete(roomId);
  } else if (wasActive && room.players.length < 2) {
    room.phase = 'abandoned';
    broadcast(room);
  } else {
    broadcast(room);
  }
}

// Schedule the bot's next move after a short human-like delay.
function scheduleBotMove(room) {
  const cur = room.getCurrentPlayer();
  if (!cur?.isBot) return;
  if (room.phase !== 'playing' && room.phase !== 'endgame') return;
  setTimeout(() => {
    if (!rooms.has(room.id)) return;
    const current = room.getCurrentPlayer();
    if (!current?.isBot) return;
    if (room.phase !== 'playing' && room.phase !== 'endgame') return;
    try {
      const action = room.botMove();
      if (!action) return;
      room.handleAction(current.id, action);
      room.lastActivity = Date.now();
      broadcast(room);
      if (room.phase === 'finished') {
        const hallOfFame = recordGameScores(room.players);
        io.to(room.id).emit('highscores', hallOfFame);
      }
      scheduleBotMove(room);
    } catch (e) {
      console.error('bot move error:', e.message);
    }
  }, 750);
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

// Optionally decode JWT from socket handshake auth — socket.data.userId set if valid
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.data.userId = payload.sub;
    } catch { /* guest — no userId */ }
  }
  next();
});

io.on('connection', socket => {
  console.log('connect', socket.id, socket.data.userId ? `(user ${socket.data.userId})` : '(guest)');

  // Update lastSeenAt for authenticated users
  if (socket.data.userId) users.touch(socket.data.userId);

  // Send current online users to the newly connected socket
  socket.emit('online_users', [...onlineUsers.entries()].map(([sid, u]) => ({ socketId: sid, name: u.name })));

  // Reconnect: client sends previous socket ID so we can restore their room slot
  socket.on('reconnect_player', ({ prevSocketId, name }) => {
    const buf = reconnectBuf.get(prevSocketId);
    if (!buf) return; // grace window expired or never buffered
    clearTimeout(buf.timer);
    reconnectBuf.delete(prevSocketId);

    const room = rooms.get(buf.roomId);
    if (!room) return;

    // Swap socket ID in the room
    const player = room.players.find(p => p.id === prevSocketId);
    if (player) {
      player.id = socket.id;
      if (room.hostId === prevSocketId) room.hostId = socket.id;
    }
    socket.data.roomId      = buf.roomId;
    socket.data.displayName = buf.name || name;
    socket.join(buf.roomId);

    if (name) onlineUsers.set(socket.id, { name, userId: socket.data.userId });
    broadcastOnlineUsers();
    room.lastActivity = Date.now();
    broadcast(room);
    // Notify the other player that their opponent is back
    socket.to(buf.roomId).emit('opponent_reconnected', { name: buf.name || name });
    console.log('reconnected', prevSocketId, '→', socket.id);
  });

  socket.on('register_online', ({ name }) => {
    if (!name?.trim()) return;
    onlineUsers.set(socket.id, { name: name.trim(), userId: socket.data.userId });
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
      socket.data.displayName = (name || '').trim() || 'Player';
      cb({ ok: true, roomId: code, state: room.getStateFor(socket.id) });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('join_room', ({ roomId, name }, cb) => {
    try {
      const room = rooms.get((roomId || '').toUpperCase());
      if (!room) throw new Error('Room not found');

      // During an active game, check reconnectBuf for a matching name — if found, restore
      // the existing slot instead of adding a new player (prevents the "third player" bug
      // when reconnect_player races or the client page-reloaded through the auth screen).
      const trimmedName = (name || '').trim() || 'Player';
      if (room.phase === 'playing' || room.phase === 'endgame') {
        for (const [prevId, buf] of reconnectBuf) {
          if (buf.roomId === room.id && buf.name === trimmedName) {
            clearTimeout(buf.timer);
            reconnectBuf.delete(prevId);
            const player = room.players.find(p => p.id === prevId);
            if (player) {
              player.id = socket.id;
              if (room.hostId === prevId) room.hostId = socket.id;
            }
            socket.data.roomId      = room.id;
            socket.data.displayName = trimmedName;
            socket.join(room.id);
            onlineUsers.set(socket.id, { name: trimmedName, userId: socket.data.userId });
            broadcastOnlineUsers();
            room.lastActivity = Date.now();
            broadcast(room);
            socket.to(room.id).emit('opponent_reconnected', { name: trimmedName });
            cb({ ok: true, state: room.getStateFor(socket.id) });
            return;
          }
        }
      }

      room.addPlayer(socket.id, trimmedName);
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.displayName = trimmedName;
      broadcast(room);
      cb({ ok: true, state: room.getStateFor(socket.id) });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('create_vs_bot', ({ name }, cb) => {
    try {
      const code = makeCode();
      const room = new GameRoom(code);
      rooms.set(code, room);
      const trimmedName = (name || '').trim() || 'Player';
      room.addPlayer(socket.id, trimmedName);
      room.addBot('Computer');
      socket.join(code);
      socket.data.roomId      = code;
      socket.data.displayName = trimmedName;
      if (trimmedName) onlineUsers.set(socket.id, { name: trimmedName, userId: socket.data.userId });
      broadcastOnlineUsers();
      room.startGame(socket.id);
      broadcast(room);
      scheduleBotMove(room); // in case bot is first to act
      cb({ ok: true, state: room.getStateFor(socket.id) });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('start_game', (_, cb) => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room) throw new Error('Not in a room');
      room.startGame(socket.id);
      // Create a DB game record so we can save history at finish
      try {
        const g = games.create(room.id);
        roomGames.set(room.id, g.id);
      } catch (_) {}
      broadcast(room);
      cb({ ok: true });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('game_action', (action, cb) => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room) throw new Error('Not in a room');
      room.handleAction(socket.id, action);
      room.lastActivity = Date.now();
      broadcast(room);
      scheduleBotMove(room); // no-op for multiplayer; fires for vs-bot games

      // When game finishes: save scores and broadcast hall of fame
      if (room.phase === 'finished') {
        const hallOfFame = recordGameScores(room.players);
        io.to(room.id).emit('highscores', hallOfFame);
        // Persist game result to DB (for history)
        try {
          const gameId = roomGames.get(room.id);
          if (gameId) {
            const sorted = [...room.players].sort((a, b) => b.currentScore - a.currentScore);
            const participants = sorted.map((p, i) => {
              const online = onlineUsers.get(p.id);
              return {
                userId:    online?.userId || null,
                guestName: p.name,
                score:     p.currentScore,
                place:     i + 1,
              };
            });
            games.finish(gameId, participants);
            roomGames.delete(room.id);
          }
        } catch (e) { console.error('game history save error', e); }
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

  // Client heartbeat — keeps lastActivity fresh so idle-cleanup doesn't fire early
  socket.on('heartbeat', () => {
    const room = rooms.get(socket.data.roomId);
    if (room) room.lastActivity = Date.now();
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const name   = socket.data.displayName;

    if (roomId) {
      const room = rooms.get(roomId);
      // Buffer ALL active-game disconnects — tab switches, mobile sleep, brief drops.
      // Only after RECONNECT_MS (3 min) with no return do we treat it as a real leave.
      if (room && (room.phase === 'playing' || room.phase === 'endgame')) {
        // Tell the other player their opponent temporarily lost connection
        socket.to(roomId).emit('opponent_temp_disconnected', { name: name || 'Opponent' });
        const timer = setTimeout(() => {
          reconnectBuf.delete(socket.id);
          handlePlayerLeave(socket.id, roomId);
          onlineUsers.delete(socket.id);
          broadcastOnlineUsers();
        }, RECONNECT_MS);
        reconnectBuf.set(socket.id, { roomId, name, timer });
        room.lastActivity = Date.now();
        console.log('disconnect buffered (3 min grace)', socket.id);
        return; // do not remove from room yet
      }
      handlePlayerLeave(socket.id, roomId);
    }

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
