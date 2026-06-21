import { useState } from 'react';
import socket from '../socket.js';

function ThiefLogo() {
  return (
    <svg className="thief-svg" viewBox="0 0 240 285" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Semi-transparent navy stripes overlaid on gold coat/arms */}
        <pattern id="tlHS" width="200" height="12" patternUnits="userSpaceOnUse">
          <rect width="200" height="6" fill="transparent"/>
          <rect y="6" width="200" height="6" fill="rgba(7,13,32,0.56)"/>
        </pattern>
      </defs>

      {/* Soft halo glow */}
      <ellipse cx="120" cy="135" rx="105" ry="112" fill="rgba(212,175,55,0.055)"/>
      {/* Ground shadow */}
      <ellipse cx="120" cy="280" rx="72" ry="6" fill="rgba(212,175,55,0.12)"/>

      {/* ── TOP HAT ── */}
      <ellipse cx="120" cy="57" rx="56" ry="10" fill="#D4AF37"/>
      <path d="M76 57 L80 8 L160 8 L164 57Z" fill="#D4AF37"/>
      {/* Crown depth shadow */}
      <path d="M142 10 L164 57 L155 57 L135 10Z" fill="rgba(0,0,0,0.1)"/>
      {/* Hat band */}
      <rect x="79" y="46" width="82" height="10" rx="2" fill="#070d20"/>
      <rect x="80" y="49" width="80" height="3.5" rx="1.5" fill="#D4AF37" opacity=".28"/>

      {/* ── HEAD ── */}
      <circle cx="120" cy="99" r="36" fill="#D4AF37"/>

      {/* ── DOMINO MASK ── */}
      <path d="M84 92 Q120 82 156 92 L154 104 Q120 114 86 104Z" fill="#070d20"/>
      {/* Eye holes */}
      <ellipse cx="103" cy="97" rx="10" ry="7.5" fill="#D4AF37"/>
      <ellipse cx="137" cy="97" rx="10" ry="7.5" fill="#D4AF37"/>
      {/* Pupils — looking sideways, suspicious/mischievous */}
      <circle cx="107" cy="98" r="5" fill="#070d20"/>
      <circle cx="141" cy="98" r="5" fill="#070d20"/>
      {/* Eye glints */}
      <circle cx="108.5" cy="96.5" r="1.8" fill="rgba(255,255,255,0.62)"/>
      <circle cx="142.5" cy="96.5" r="1.8" fill="rgba(255,255,255,0.62)"/>

      {/* ── SMIRK ── gives the character personality */}
      <path d="M108 119 Q120 129 132 119" stroke="#8a6c08" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* ── SCARF / collar ── */}
      <path d="M86 112 Q120 104 154 112 Q151 128 120 132 Q89 128 86 112Z" fill="#9a7c10"/>
      <path d="M90 112 Q120 107 150 112" stroke="#D4AF37" strokeWidth="1.5" fill="none" opacity=".38"/>
      <rect x="112" y="130" width="16" height="12" fill="#D4AF37"/>

      {/* ── COAT — gold base then stripe overlay ── */}
      <path d="M64 143 L44 266 L196 266 L176 143 Q120 128 64 143Z" fill="#D4AF37"/>
      <path d="M64 143 L44 266 L196 266 L176 143 Q120 128 64 143Z" fill="url(#tlHS)"/>
      {/* Lapels on top of stripes */}
      <path d="M120 143 L100 169 L120 161Z" fill="#9a7c10"/>
      <path d="M120 143 L140 169 L120 161Z" fill="#9a7c10"/>
      <path d="M100 143 Q120 151 140 143" stroke="#5a4006" strokeWidth="2" fill="none"/>
      {/* Buttons — gold with dark ring so visible through stripes */}
      <circle cx="120" cy="183" r="4.5" fill="#D4AF37" stroke="#070d20" strokeWidth="2"/>
      <circle cx="120" cy="206" r="4.5" fill="#D4AF37" stroke="#070d20" strokeWidth="2"/>
      <circle cx="120" cy="229" r="4.5" fill="#D4AF37" stroke="#070d20" strokeWidth="2"/>

      {/* ── LEFT ARM — raised high, stolen cards ── */}
      <path d="M64 151 L18 63 L34 53 L80 144Z" fill="#D4AF37"/>
      <path d="M64 151 L18 63 L34 53 L80 144Z" fill="url(#tlHS)"/>
      {/* Fist */}
      <circle cx="20" cy="57" r="15" fill="#D4AF37"/>
      {/* Card fan — 3 cards fanned above fist */}
      <g transform="translate(26,33)">
        <g transform="rotate(-32)">
          <rect x="-10" y="-30" width="20" height="28" rx="3.5" fill="#1a3a8c" stroke="#5a8ade" strokeWidth="1.2"/>
          <rect x="-7" y="-27" width="14" height="22" rx="2" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        </g>
        <g transform="rotate(-7)">
          <rect x="-10" y="-30" width="20" height="28" rx="3.5" fill="#fffff0" stroke="#C8A060" strokeWidth="1.2"/>
          <text x="-5" y="-16" fontSize="11" fontWeight="900" fontFamily="Georgia,serif" fill="#CC1111">A</text>
          <text x="-4.5" y="-6" fontSize="10" fill="#CC1111">♥</text>
        </g>
        <g transform="rotate(18)">
          <rect x="-10" y="-30" width="20" height="28" rx="3.5" fill="#fffff0" stroke="#C8A060" strokeWidth="1.2"/>
          <text x="-6" y="-16" fontSize="11" fontWeight="900" fontFamily="Georgia,serif" fill="#111">K</text>
          <text x="-4.5" y="-6" fontSize="10" fill="#111">♠</text>
        </g>
      </g>

      {/* ── RIGHT ARM — money bag ── */}
      <path d="M176 151 L210 208 L198 222 L162 163Z" fill="#D4AF37"/>
      <path d="M176 151 L210 208 L198 222 L162 163Z" fill="url(#tlHS)"/>
      {/* Money bag */}
      <circle cx="212" cy="230" r="22" fill="#C8A020" stroke="#9a7008" strokeWidth="1.5"/>
      <path d="M198 210 Q212 200 226 210" stroke="#8a6008" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M199 222 Q212 231 225 222" stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none"/>
      <text x="212" y="237" textAnchor="middle" fontSize="17" fontWeight="900" fill="#050d1e" fontFamily="Georgia,serif">$</text>
    </svg>
  );
}

export default function Lobby({ onJoined }) {
  const [name,  setName]  = useState('');
  const [code,  setCode]  = useState('');
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);
  const [tab,   setTab]   = useState('create'); // 'create' | 'join'

  function go(fn) {
    if (!name.trim()) { setErr('Enter your name first'); return; }
    setBusy(true); setErr('');
    socket.connect();
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
        </div>

        {/* ── Card / Form ── */}
        <div className="lobby-form-card">
          {/* Name always shown */}
          <div className="lf-field">
            <label className="lf-label">Your Name</label>
            <input className="lf-input" placeholder="Enter your name…" maxLength={20}
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? create() : join())} />
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

          <p className="lf-rules-hint">2–6 players · Steal, pair, lock — most sets wins</p>
        </div>
      </div>
    </div>
  );
}
