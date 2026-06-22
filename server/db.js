/**
 * Minimal JSON-file persistence layer.
 * Three stores: users, friendships, games.
 * All writes are synchronous and atomic (writeFileSync).
 * Suitable for a small community deployment on Railway with a persistent volume.
 */

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('crypto');

// crypto.randomUUID is available in Node 14.17+ / 15.6+
function uid() {
  try { return require('crypto').randomUUID(); }
  catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

// ── File paths ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PATHS = {
  users:       path.join(DATA_DIR, 'users.json'),
  friendships: path.join(DATA_DIR, 'friendships.json'),
  games:       path.join(DATA_DIR, 'games.json'),
};

function load(key) {
  try { return JSON.parse(fs.readFileSync(PATHS[key], 'utf8')); }
  catch { return []; }
}

function save(key, data) {
  fs.writeFileSync(PATHS[key], JSON.stringify(data, null, 2), 'utf8');
}

// ── Users ─────────────────────────────────────────────────────────────────────

const users = {
  findByUsername(username) {
    return load('users').find(u => u.username.toLowerCase() === username.toLowerCase());
  },
  findByEmail(email) {
    return load('users').find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  },
  findById(id) {
    return load('users').find(u => u.id === id);
  },
  create({ username, displayName, email, passwordHash }) {
    const all = load('users');
    const user = {
      id: uid(),
      username: username.trim(),
      displayName: displayName.trim(),
      email: (email || '').trim().toLowerCase() || null,
      passwordHash,
      createdAt:  new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    all.push(user);
    save('users', all);
    return user;
  },
  touch(id) {
    const all = load('users');
    const u = all.find(u => u.id === id);
    if (u) { u.lastSeenAt = new Date().toISOString(); save('users', all); }
  },
  public(user) {
    const { passwordHash, ...pub } = user;
    return pub;
  },
};

// ── Friendships ───────────────────────────────────────────────────────────────

const friendships = {
  /** status: 'pending' | 'accepted' */
  send(requesterId, receiverId) {
    const all = load('friendships');
    const exists = all.find(
      f => (f.requesterId === requesterId && f.receiverId === receiverId) ||
           (f.requesterId === receiverId  && f.receiverId === requesterId)
    );
    if (exists) return exists;
    const f = {
      id: uid(),
      requesterId,
      receiverId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(f);
    save('friendships', all);
    return f;
  },
  respond(friendshipId, userId, accept) {
    const all = load('friendships');
    const f = all.find(f => f.id === friendshipId && f.receiverId === userId);
    if (!f) return null;
    f.status = accept ? 'accepted' : 'declined';
    f.updatedAt = new Date().toISOString();
    save('friendships', all);
    return f;
  },
  /** Returns { friends: User[], pending: { sent, received } } */
  getForUser(userId) {
    const all  = load('friendships');
    const mine = all.filter(f => f.requesterId === userId || f.receiverId === userId);
    const allUsers = load('users');
    const pub = u => users.public(u);
    const getUser = id => { const u = allUsers.find(u => u.id === id); return u ? pub(u) : null; };

    const friends = mine
      .filter(f => f.status === 'accepted')
      .map(f => getUser(f.requesterId === userId ? f.receiverId : f.requesterId))
      .filter(Boolean);

    const sentPending = mine
      .filter(f => f.status === 'pending' && f.requesterId === userId)
      .map(f => ({ ...f, receiver: getUser(f.receiverId) }));

    const receivedPending = mine
      .filter(f => f.status === 'pending' && f.receiverId === userId)
      .map(f => ({ ...f, requester: getUser(f.requesterId) }));

    return { friends, sent: sentPending, received: receivedPending };
  },
  remove(userId, otherId) {
    let all = load('friendships');
    all = all.filter(f =>
      !((f.requesterId === userId && f.receiverId === otherId) ||
        (f.requesterId === otherId && f.receiverId === userId))
    );
    save('friendships', all);
  },
};

// ── Games ─────────────────────────────────────────────────────────────────────

const games = {
  create(roomCode) {
    const all = load('games');
    const g = {
      id: uid(),
      roomCode,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      participants: [],  // { userId|null, guestName, score, place }
    };
    all.push(g);
    save('games', all);
    return g;
  },
  finish(gameId, participants) {
    const all = load('games');
    const g = all.find(g => g.id === gameId);
    if (!g) return;
    g.status = 'completed';
    g.endedAt = new Date().toISOString();
    g.participants = participants;
    save('games', all);
    return g;
  },
  abandon(gameId) {
    const all = load('games');
    const g = all.find(g => g.id === gameId);
    if (!g) return;
    g.status = 'abandoned';
    g.endedAt = new Date().toISOString();
    save('games', all);
  },
  getHistory(userId, limit = 20) {
    const all = load('games');
    return all
      .filter(g => g.status !== 'active' && g.participants.some(p => p.userId === userId))
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
      .slice(0, limit)
      .map(g => {
        // Attach display names
        const allUsers = load('users');
        return {
          ...g,
          participants: g.participants.map(p => ({
            ...p,
            displayName: p.userId
              ? (allUsers.find(u => u.id === p.userId)?.displayName || p.guestName)
              : p.guestName,
          })),
        };
      });
  },
};

// ── Search ────────────────────────────────────────────────────────────────────

function searchUsers(query, excludeId) {
  const q = (query || '').toLowerCase().trim();
  if (q.length < 2) return [];
  return load('users')
    .filter(u => u.id !== excludeId &&
      (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)))
    .slice(0, 10)
    .map(u => users.public(u));
}

module.exports = { users, friendships, games, searchUsers };
