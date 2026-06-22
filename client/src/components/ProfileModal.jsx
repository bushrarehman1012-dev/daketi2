import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const BASE = import.meta.env.VITE_SERVER_URL ?? '';

function api(path, token, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(r => r.json());
}

// ── Tab: Profile ──────────────────────────────────────────────────────────────

function ProfileTab({ user }) {
  return (
    <div className="pm-section">
      <div className="pm-avatar-row">
        <div className="pm-avatar">{(user.displayName?.[0] || '?').toUpperCase()}</div>
        <div>
          <div className="pm-display-name">{user.displayName}</div>
          <div className="pm-username">@{user.username}</div>
          {user.email && <div className="pm-email">{user.email}</div>}
          <div className="pm-since">Member since {new Date(user.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Friends ──────────────────────────────────────────────────────────────

function FriendsTab({ token }) {
  const [data,    setData]    = useState({ friends: [], sent: [], received: [] });
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [err,     setErr]     = useState('');
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    api('/api/friends', token).then(d => setData(d)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api(`/api/friends/search?q=${encodeURIComponent(search)}`, token)
        .then(r => setResults(Array.isArray(r) ? r : []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search, token]);

  async function sendRequest(targetUserId) {
    setBusy(true); setErr('');
    try {
      await api('/api/friends/request', token, { method: 'POST', body: { targetUserId } });
      setSearch(''); setResults([]);
      const d = await api('/api/friends', token);
      setData(d);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function respond(id, accept) {
    await api(`/api/friends/${id}/respond`, token, { method: 'POST', body: { accept } });
    const d = await api('/api/friends', token);
    setData(d);
  }

  async function remove(userId) {
    await api(`/api/friends/${userId}`, token, { method: 'DELETE' });
    const d = await api('/api/friends', token);
    setData(d);
  }

  return (
    <div className="pm-section">
      {/* Search */}
      <div className="pm-search-row">
        <input
          className="lf-input pm-search-input"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {results.length > 0 && (
        <div className="pm-search-results">
          {results.map(u => (
            <div key={u.id} className="pm-friend-row">
              <div className="pm-friend-av">{(u.displayName[0] || '?').toUpperCase()}</div>
              <div className="pm-friend-name">
                <span>{u.displayName}</span>
                <span className="pm-friend-un">@{u.username}</span>
              </div>
              <button className="pm-btn pm-btn--sm" disabled={busy} onClick={() => sendRequest(u.id)}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="lf-error">⚠ {err}</p>}

      {/* Received pending */}
      {data.received.length > 0 && (
        <>
          <div className="pm-subhead">Friend Requests</div>
          {data.received.map(f => (
            <div key={f.id} className="pm-friend-row">
              <div className="pm-friend-av">{(f.requester?.displayName[0] || '?').toUpperCase()}</div>
              <div className="pm-friend-name">
                <span>{f.requester?.displayName}</span>
                <span className="pm-friend-un">@{f.requester?.username}</span>
              </div>
              <div className="pm-btn-pair">
                <button className="pm-btn pm-btn--accept" onClick={() => respond(f.id, true)}>✓</button>
                <button className="pm-btn pm-btn--decline" onClick={() => respond(f.id, false)}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Friends */}
      <div className="pm-subhead">Friends ({data.friends.length})</div>
      {data.friends.length === 0
        ? <p className="pm-empty">No friends yet — search above to add players!</p>
        : data.friends.map(u => (
          <div key={u.id} className="pm-friend-row">
            <div className="pm-friend-av pm-friend-av--online">{(u.displayName[0] || '?').toUpperCase()}</div>
            <div className="pm-friend-name">
              <span>{u.displayName}</span>
              <span className="pm-friend-un">@{u.username}</span>
            </div>
            <button className="pm-btn pm-btn--sm pm-btn--remove" onClick={() => remove(u.id)}>✕</button>
          </div>
        ))
      }

      {/* Sent pending */}
      {data.sent.length > 0 && (
        <>
          <div className="pm-subhead">Pending Sent</div>
          {data.sent.map(f => (
            <div key={f.id} className="pm-friend-row pm-friend-row--dim">
              <div className="pm-friend-av">{(f.receiver?.displayName[0] || '?').toUpperCase()}</div>
              <div className="pm-friend-name">
                <span>{f.receiver?.displayName}</span>
                <span className="pm-friend-un">Awaiting response</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Tab: History ──────────────────────────────────────────────────────────────

function HistoryTab({ token, userId }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api('/api/history', token).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => setHistory([]));
  }, [token]);

  if (history === null) return <div className="pm-loading">Loading…</div>;
  if (history.length === 0) return <p className="pm-empty">No completed games yet. Play a game to see your history here!</p>;

  return (
    <div className="pm-section">
      {history.map(g => {
        const me = g.participants.find(p => p.userId === userId);
        const place = me?.place;
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '';
        const winner = g.participants.find(p => p.place === 1);
        return (
          <div key={g.id} className={`pm-game-row ${place === 1 ? 'pm-game-row--win' : ''}`}>
            <div className="pm-game-date">{new Date(g.endedAt).toLocaleDateString()} {new Date(g.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="pm-game-players">
              {g.participants.map((p, i) => (
                <span key={i} className={`pm-game-player ${p.userId === userId ? 'pm-game-player--me' : ''}`}>
                  {p.displayName} <span className="pm-game-score">{p.score}pts</span>
                  {i < g.participants.length - 1 && <span className="pm-game-sep"> vs </span>}
                </span>
              ))}
            </div>
            <div className="pm-game-result">
              {medal} {place === 1 ? 'Won' : `${place}${place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'} place`}
              {place !== 1 && winner && <span className="pm-game-winner"> · Won by {winner.displayName}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ProfileModal ──────────────────────────────────────────────────────────────

export default function ProfileModal({ onClose }) {
  const { user, getToken, logout } = useAuth();
  const [tab, setTab] = useState('profile');
  const token = getToken();

  if (!user) return null;

  function handleLogout() {
    logout();
    onClose();
  }

  return (
    <div className="pm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal">
        <div className="pm-header">
          <div className="pm-tabs">
            {['profile', 'friends', 'history'].map(t => (
              <button key={t} className={`pm-tab ${tab === t ? 'pm-tab--active' : ''}`} onClick={() => setTab(t)}>
                {t === 'profile' ? 'Profile' : t === 'friends' ? 'Friends' : 'History'}
              </button>
            ))}
          </div>
          <div className="pm-header-right">
            <button className="pm-logout" onClick={handleLogout}>Log Out</button>
            <button className="pm-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="pm-body">
          {tab === 'profile' && <ProfileTab user={user} />}
          {tab === 'friends' && <FriendsTab token={token} />}
          {tab === 'history' && <HistoryTab token={token} userId={user.id} />}
        </div>
      </div>
    </div>
  );
}
