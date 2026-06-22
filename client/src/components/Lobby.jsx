import { useState, useEffect } from 'react';
import socket from '../socket.js';

function ThiefLogo() {
  return <img src="/thief.png" className="thief-img" alt="Daketi Thief" />;
}

export default function Lobby({ onJoined, onlineUsers = [], mySocketId, user, onOpenProfile }) {
  // Logged-in users get their display name pre-filled and locked
  const [name,  setName]  = useState(() => user?.displayName || localStorage.getItem('daketi_name') || '');
  const [code,  setCode]  = useState('');
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);
  const [tab,   setTab]   = useState('create'); // 'create' | 'join'

  // Connect early and register online if we already have a saved name
  useEffect(() => {
    const saved = localStorage.getItem('daketi_name') || '';
    if (saved.trim().length >= 2) {
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => socket.emit('register_online', { name: saved.trim() }));
      } else {
        socket.emit('register_online', { name: saved.trim() });
      }
    }
  }, []);

  function handleNameChange(e) {
    const n = e.target.value;
    setName(n);
    localStorage.setItem('daketi_name', n.trim());
    if (n.trim().length >= 2) {
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => socket.emit('register_online', { name: n.trim() }));
      } else {
        socket.emit('register_online', { name: n.trim() });
      }
    }
  }

  function go(fn) {
    if (!name.trim()) { setErr('Enter your name first'); return; }
    setBusy(true); setErr('');
    if (!socket.connected) socket.connect();
    fn();
  }

  function create() {
    go(() => socket.emit('create_room', { name }, res => {
      setBusy(false);
      if (res.ok) onJoined(res.state); else setErr(res.error);
    }));
  }

  function join() {
    if (!code.trim()) { setErr('Enter a room code'); return; }
    go(() => socket.emit('join_room', { roomId: code.trim().toUpperCase(), name }, res => {
      setBusy(false);
      if (res.ok) onJoined(res.state); else setErr(res.error);
    }));
  }

  return (
    <div className="lobby-root">
      {/* ── Background card suit decorations ── */}
      <div className="lobby-bg-suits" aria-hidden>
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>

      <div className="lobby-content">
        {/* ── Logo ── */}
        <div className="lobby-logo-wrap">
          <ThiefLogo />
          <div className="lobby-brand">
            <h1 className="lobby-wordmark">DAKETI</h1>
            <p className="lobby-tagline">The Art of the Steal</p>
          </div>
          {user && (
            <button className="lobby-profile-btn" onClick={onOpenProfile}>
              <span className="lobby-profile-av">{(user.displayName?.[0] || '?').toUpperCase()}</span>
              <span>{user.displayName}</span>
              <span className="lobby-profile-caret">▾</span>
            </button>
          )}
        </div>

        {/* ── Card / Form ── */}
        <div className="lobby-form-card">
          {/* Name — locked if logged in (comes from account) */}
          <div className="lf-field">
            <label className="lf-label">Your Name</label>
            {user ? (
              <div className="lf-input lf-input--locked">{user.displayName}</div>
            ) : (
              <input className="lf-input" placeholder="Enter your name…" maxLength={20}
                value={name} onChange={handleNameChange}
                onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? create() : join())} />
            )}
          </div>

          {/* Tabs */}
          <div className="lf-tabs">
            <button className={`lf-tab ${tab === 'create' ? 'lf-tab--active' : ''}`} onClick={() => setTab('create')}>
              Create Room
            </button>
            <button className={`lf-tab ${tab === 'join' ? 'lf-tab--active' : ''}`} onClick={() => setTab('join')}>
              Join Room
            </button>
          </div>

          {tab === 'create' ? (
            <button className="lf-btn lf-btn--primary" onClick={create} disabled={busy}>
              {busy ? 'Connecting…' : '+ Create New Room'}
            </button>
          ) : (
            <div className="lf-join-row">
              <input className="lf-input lf-input--code" placeholder="ROOM" maxLength={4}
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && join()} />
              <button className="lf-btn lf-btn--secondary" onClick={join} disabled={busy}>
                {busy ? '…' : 'Join'}
              </button>
            </div>
          )}

          {err && <p className="lf-error">⚠ {err}</p>}

          {onlineUsers.filter(u => u.socketId !== mySocketId).length > 0 && (
            <div className="lf-online-chip">
              <span className="lf-online-dot"/>
              {onlineUsers.filter(u => u.socketId !== mySocketId).length} online now
            </div>
          )}
          <p className="lf-rules-hint">2–6 players · Steal, pair, lock — most sets wins</p>
        </div>
      </div>
    </div>
  );
}
