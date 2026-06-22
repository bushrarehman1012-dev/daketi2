import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';
import Chat from './Chat.jsx';
import { useVoiceChat } from '../hooks/useVoiceChat.js';
import { useAchievements, AchievementToast } from './AchievementToast.jsx';
import { sfx } from '../utils/sounds.js';

const SUIT = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED  = new Set(['hearts', 'diamonds']);

// ── Deck card with thief logo ─────────────────────────────────────────────────

function DeckCard({ count }) {
  return (
    <div className="deck-card">
      <img src="/thief.png" className="deck-thief" alt="Daketi Thief" />
      <div className="deck-count">{count}</div>
    </div>
  );
}

// ── Standard playing card pip positions ──────────────────────────────────────
// [x%, y%] within the pip area. Symmetric: each pip above 50% has a mirror
// below 50%. Pips at y > 50 are rotated 180° (standard card convention).
const PIP_POS = {
  'A':  [[50,50]],
  '2':  [[50,18],[50,82]],
  '3':  [[50,12],[50,50],[50,88]],
  '4':  [[27,20],[73,20],[27,80],[73,80]],
  '5':  [[27,20],[73,20],[50,50],[27,80],[73,80]],
  '6':  [[27,18],[73,18],[27,50],[73,50],[27,82],[73,82]],
  // 7: 6-layout + 1 upper-center pip (7 is intentionally asymmetric)
  '7':  [[27,15],[73,15],[50,33],[27,53],[73,53],[27,78],[73,78]],
  // 8: 7-layout mirrored — adds lower-center pip to make it symmetric
  '8':  [[27,13],[73,13],[50,30],[27,50],[73,50],[50,70],[27,87],[73,87]],
  // 9: 4 corner-pairs + 1 center
  '9':  [[27,12],[73,12],[27,34],[73,34],[50,50],[27,66],[73,66],[27,88],[73,88]],
  // 10: 3 row-pairs + upper & lower center pips
  '10': [[27,10],[73,10],[50,26],[27,38],[73,38],[27,62],[73,62],[50,74],[27,90],[73,90]],
};

// Portrait illustration for top-half of a face card (fits in 56 × 25 SVG units)
function Portrait({ rank, isRed }) {
  const skin      = '#F5C598';
  const hairDark  = '#3a1a00';
  const robeColor = isRed ? '#8B0000' : '#1a1a6a';
  const trimColor = isRed ? '#c84040' : '#3a3aaa';

  if (rank === 'K') return (
    <g>
      {/* Crown */}
      <path d="M18 9 L21 3 L25 7 L28 2 L31 7 L35 3 L38 9 L36 11 L20 11Z" fill="#D4AF37" stroke="#8a6000" strokeWidth=".5"/>
      <ellipse cx="28" cy="11" rx="10" ry="2.2" fill="#D4AF37" stroke="#8a6000" strokeWidth=".4"/>
      <circle cx="25" cy="5.5" r="1.2" fill="#CC1111"/>
      <circle cx="28" cy="4" r="1.2" fill="#CC1111"/>
      <circle cx="31" cy="5.5" r="1.2" fill="#CC1111"/>
      {/* Face */}
      <ellipse cx="28" cy="17" rx="8" ry="8.5" fill={skin} stroke="#c8a070" strokeWidth=".4"/>
      {/* Eyebrows */}
      <path d="M22 13 Q25 11.5 27.5 13" stroke={hairDark} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <path d="M28.5 13 Q31 11.5 34 13" stroke={hairDark} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      {/* Eyes */}
      <ellipse cx="24.8" cy="15" rx="2.2" ry="1.6" fill="white"/>
      <circle cx="25.1" cy="15" r="1.2" fill="#1a0a00"/>
      <circle cx="25.5" cy="14.4" r=".45" fill="white"/>
      <ellipse cx="31.2" cy="15" rx="2.2" ry="1.6" fill="white"/>
      <circle cx="31.5" cy="15" r="1.2" fill="#1a0a00"/>
      <circle cx="31.9" cy="14.4" r=".45" fill="white"/>
      {/* Nose */}
      <path d="M27 19 Q28 20.5 29 19" stroke="#c09060" strokeWidth=".9" fill="none" strokeLinecap="round"/>
      {/* Beard & moustache */}
      <path d="M21 21 Q24 19.5 28 21 Q32 19.5 35 21" fill={hairDark} stroke={hairDark} strokeWidth=".4"/>
      <path d="M20 22 Q24 20 28 22 Q32 20 36 22 Q33 26 28 27 Q23 26 20 22Z" fill={hairDark}/>
      {/* Robe collar */}
      <path d="M13 25 Q20 22 28 21.5 Q36 22 43 25Z" fill={robeColor}/>
      <path d="M23 25 L26 21.5 M33 25 L30 21.5" stroke={trimColor} strokeWidth=".8"/>
    </g>
  );

  if (rank === 'Q') return (
    <g>
      {/* Crown */}
      <path d="M20 9 L22 4 L26 7.5 L28 3 L30 7.5 L34 4 L36 9 L34 11 L22 11Z" fill="#D4AF37" stroke="#8a6000" strokeWidth=".5"/>
      <ellipse cx="28" cy="11" rx="8.5" ry="2" fill="#D4AF37" stroke="#8a6000" strokeWidth=".4"/>
      <circle cx="25" cy="6" r="1.1" fill="#9900CC"/>
      <circle cx="28" cy="4.5" r="1.1" fill="#9900CC"/>
      <circle cx="31" cy="6" r="1.1" fill="#9900CC"/>
      {/* Long hair */}
      <ellipse cx="19" cy="19" rx="4.5" ry="9" fill={hairDark}/>
      <ellipse cx="37" cy="19" rx="4.5" ry="9" fill={hairDark}/>
      {/* Face */}
      <ellipse cx="28" cy="17" rx="7.5" ry="8" fill={skin} stroke="#c8a070" strokeWidth=".4"/>
      {/* Eyebrows — arched */}
      <path d="M22.5 13 Q25 11.5 27 13" stroke={hairDark} strokeWidth="1" fill="none" strokeLinecap="round"/>
      <path d="M29 13 Q31 11.5 33.5 13" stroke={hairDark} strokeWidth="1" fill="none" strokeLinecap="round"/>
      {/* Eyes with lashes */}
      <ellipse cx="24.5" cy="15" rx="2" ry="1.5" fill="white"/>
      <circle cx="24.8" cy="15" r="1.1" fill="#2a0050"/>
      <circle cx="25.2" cy="14.4" r=".4" fill="white"/>
      <path d="M22.5 13.5 L23 12.5 M24.5 13 L24.5 12 M26.5 13.5 L26 12.5" stroke={hairDark} strokeWidth=".8" strokeLinecap="round"/>
      <ellipse cx="31.5" cy="15" rx="2" ry="1.5" fill="white"/>
      <circle cx="31.8" cy="15" r="1.1" fill="#2a0050"/>
      <circle cx="32.2" cy="14.4" r=".4" fill="white"/>
      <path d="M29.5 13.5 L30 12.5 M31.5 13 L31.5 12 M33.5 13.5 L33 12.5" stroke={hairDark} strokeWidth=".8" strokeLinecap="round"/>
      {/* Nose */}
      <path d="M27.2 18.5 Q28 20 28.8 18.5" stroke="#c09060" strokeWidth=".8" fill="none" strokeLinecap="round"/>
      {/* Lips */}
      <path d="M24.5 22 Q28 24 31.5 22" stroke="#c06080" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M24.5 22 Q28 20.5 31.5 22" stroke="#e08090" strokeWidth=".7" fill="none" strokeLinecap="round"/>
      {/* Dress neckline */}
      <path d="M14 25 Q21 22.5 28 22 Q35 22.5 42 25Z" fill={robeColor}/>
      <path d="M22 25 L25 22.5 M34 25 L31 22.5" stroke={trimColor} strokeWidth=".8"/>
    </g>
  );

  // Jack
  return (
    <g>
      {/* Feathered hat brim */}
      <ellipse cx="28" cy="10" rx="13" ry="2.5" fill={robeColor}/>
      {/* Hat body */}
      <path d="M16 10 Q18 5 28 4 Q38 5 40 10Z" fill={robeColor}/>
      {/* Feather */}
      <path d="M39 8 Q46 2 48 6 Q45 9 40 11Z" fill={isRed ? '#ff6060' : '#6080ff'} opacity=".85"/>
      <path d="M39 8 Q44 4 46 7" stroke="rgba(255,255,255,.4)" strokeWidth=".7" fill="none" strokeLinecap="round"/>
      {/* Hair peeking from hat */}
      <path d="M17 10 Q20 8 22 11" stroke={hairDark} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      <path d="M34 11 Q36 8 39 10" stroke={hairDark} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      {/* Face — younger, narrower */}
      <ellipse cx="28" cy="17.5" rx="7" ry="7.5" fill={skin} stroke="#c8a070" strokeWidth=".4"/>
      {/* Eyebrows */}
      <path d="M23 14 Q25.5 12.5 27.5 13.5" stroke={hairDark} strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <path d="M28.5 13.5 Q30.5 12.5 33 14" stroke={hairDark} strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      {/* Eyes */}
      <ellipse cx="25" cy="16" rx="2" ry="1.5" fill="white"/>
      <circle cx="25.3" cy="16" r="1.1" fill="#1a2848"/>
      <circle cx="25.7" cy="15.3" r=".4" fill="white"/>
      <ellipse cx="31" cy="16" rx="2" ry="1.5" fill="white"/>
      <circle cx="31.3" cy="16" r="1.1" fill="#1a2848"/>
      <circle cx="31.7" cy="15.3" r=".4" fill="white"/>
      {/* Nose */}
      <path d="M27.2 19.5 Q28 21 28.8 19.5" stroke="#c09060" strokeWidth=".8" fill="none" strokeLinecap="round"/>
      {/* Smirk */}
      <path d="M24.5 22.5 Q28 24.5 31.5 23" stroke="#8a4030" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {/* Collar & ruffles */}
      <path d="M15 25 Q22 22.5 28 22 Q34 22.5 41 25Z" fill={robeColor}/>
      <path d="M24 25 Q26 22 28 24 Q30 22 32 25" stroke={trimColor} strokeWidth=".9" fill="none"/>
    </g>
  );
}

// Two-headed face card with portrait illustrations
function FaceCard({ rank, suit, small = false }) {
  const sym   = SUIT[suit];
  const isRed = RED.has(suit);
  const c     = isRed ? '#C80000' : '#111111';

  if (small) {
    return (
      <div className="tc-face-center">
        <span style={{ fontFamily:'Georgia,serif', fontSize:'11px', fontWeight:900, color:c, lineHeight:1 }}>{rank}</span>
        <span style={{ fontSize:'8px', color:c, lineHeight:1 }}>{sym}</span>
      </div>
    );
  }

  return (
    <svg className="hc-face-svg" viewBox="0 0 56 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Faint card-face border */}
      <rect x="1" y="1" width="54" height="48" rx="3" stroke={c} strokeWidth=".4" opacity=".15"/>
      {/* Top portrait */}
      <Portrait rank={rank} isRed={isRed} />
      {/* Divider */}
      <line x1="4" y1="25" x2="52" y2="25" stroke={c} strokeWidth=".6" opacity=".2"/>
      {/* Bottom portrait — 180° rotated copy */}
      <g transform="translate(56,50) rotate(180)">
        <Portrait rank={rank} isRed={isRed} />
      </g>
    </svg>
  );
}

function CardPips({ rank, suit, small = false }) {
  const sym  = SUIT[suit];
  const pips = PIP_POS[rank];

  // Face card (J / Q / K) — no pip positions defined
  if (!pips) return <FaceCard rank={rank} suit={suit} small={small} />;

  const n  = pips.length;
  const fs = small
    ? (n <= 1 ? 18 : n <= 4 ? 11 : 8)
    : (n <= 1 ? 36 : n <= 4 ? 18 : n <= 6 ? 15 : 13);  // Ace gets large 36px pip

  return (
    <div className={small ? 'tc-pips' : 'hc-pips'}>
      {pips.map(([x, y], i) => (
        <span key={i} className="hc-pip" style={{
          left: `${x}%`, top: `${y}%`, fontSize: `${fs}px`,
          transform: `translate(-50%,-50%)${y > 50 ? ' rotate(180deg)' : ''}`,
        }}>{sym}</span>
      ))}
    </div>
  );
}

// ── Card components ──────────────────────────────────────────────────────────

function HandCard({ card, selected, canPlay, isNew, onClick }) {
  if (!card) return null;
  return (
    <div
      className={['hc', RED.has(card.suit)?'hc-r':'hc-b', selected?'hc-sel':'', canPlay?'hc-pick':'', isNew?'hc-new':''].filter(Boolean).join(' ')}
      onClick={onClick}
      title={`${card.rank} of ${card.suit}`}
    >
      <div className="hc-corner hc-tl"><span className="hc-rank">{card.rank}</span><span className="hc-suit">{SUIT[card.suit]}</span></div>
      <CardPips rank={card.rank} suit={card.suit} />
      <div className="hc-corner hc-br"><span className="hc-rank">{card.rank}</span><span className="hc-suit">{SUIT[card.suit]}</span></div>
    </div>
  );
}

function TableCard({ card, faceDown, glow, pulsing, locked, onClick }) {
  if (faceDown) return <div className="tc tc-back"><div className="tc-pat"/></div>;
  if (!card)    return null;
  return (
    <div
      className={['tc', RED.has(card.suit)?'tc-r':'tc-b', glow?'tc-glow':'', pulsing?'tc-pulse':'', locked?'tc-locked':''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <div className="tc-corner tc-tl"><span className="tc-rank">{card.rank}</span><span className="tc-suit-sm">{SUIT[card.suit]}</span></div>
      <CardPips rank={card.rank} suit={card.suit} small />
      <div className="tc-corner tc-br"><span className="tc-rank">{card.rank}</span><span className="tc-suit-sm">{SUIT[card.suit]}</span></div>
      {locked && <span className="tc-lock-badge">🔒</span>}
    </div>
  );
}

// ── Score panel ───────────────────────────────────────────────────────────────

function ScorePanel({ players, myId, currentPlayerId }) {
  const sorted = [...players].sort((a, b) => b.currentScore - a.currentScore);
  return (
    <div className="score-panel">
      <div className="score-panel-title">SCORES</div>
      {sorted.map((p, rank) => (
        <div
          key={p.id}
          className={[
            'score-row',
            p.id === myId            ? 'score-row--me'     : '',
            p.id === currentPlayerId ? 'score-row--active' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="score-rank">#{rank + 1}</span>
          <span className="score-name">{p.id === myId ? 'You' : p.name}</span>
          <span className="score-val">{p.currentScore}</span>
        </div>
      ))}
    </div>
  );
}

// ── Game Over ─────────────────────────────────────────────────────────────────

function GameOver({ players, myId, highscores }) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="go-wrap">
      <div className="go-panel">
        <div className="go-header">
          <span className="go-icon">🃏</span>
          <h1 className="go-title">Round Over</h1>
        </div>
        <div className="go-section-label">This Round</div>
        <div className="go-list">
          {ranked.map((p, i) => (
            <div key={p.id} className={`go-row ${p.id === myId ? 'go-row-me' : ''}`}>
              <span className="go-medal">{['🥇','🥈','🥉'][i] ?? `${i+1}`}</span>
              <span className="go-name">{p.name}</span>
              <span className="go-score">{p.score} pts</span>
            </div>
          ))}
        </div>
        {highscores.length > 0 && (
          <>
            <div className="go-section-label go-section-label--hof">🏆 Hall of Fame</div>
            <div className="go-list">
              {highscores.slice(0, 8).map((s, i) => (
                <div key={i} className="go-row go-hof-row">
                  <span className="go-medal go-hof-rank">#{i+1}</span>
                  <span className="go-name">{s.name}</span>
                  <span className="go-score">{s.score} pts</span>
                </div>
              ))}
            </div>
          </>
        )}
        <button className="btn-primary" onClick={() => window.location.reload()}>Play Again</button>
      </div>
    </div>
  );
}

// ── Main Game ─────────────────────────────────────────────────────────────────

export default function Game({ state, myId, chatMessages, highscores, onLeave }) {
  const [sel,      setSel]      = useState(null);
  const [feedback, setFeedback] = useState('');
  const [err,      setErr]      = useState('');
  const [newId,    setNewId]    = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const prevHandRef     = useRef([]);
  const prevStateRef    = useRef(null);
  const gameOverSfxDone = useRef(false);

  const voice = useVoiceChat(myId);
  const ach   = useAchievements();

  const me       = state.players.find(p => p.id === myId);
  const isMyTurn = state.currentPlayerId === myId;
  const others   = state.players.filter(p => p.id !== myId);

  // Last COLLECTED slot — the only one eligible for PAIR_OWN / the only stealable target.
  // If it is locked (formal or implicit), PAIR_OWN is not possible and opponents see nothing.
  const lastSlot = me?.slots?.at(-1) ?? null;

  // ── Newly drawn card animation ────────────────────────────────────────────
  useEffect(() => {
    if (!me?.hand) return;
    const prev = new Set(prevHandRef.current.map(c => c.id));
    const drew = me.hand.find(c => !prev.has(c.id));
    if (drew) { setNewId(drew.id); setTimeout(() => setNewId(null), 800); sfx.deal(); }
    prevHandRef.current = me.hand;
  }, [me?.hand]);

  // ── Achievement detection ─────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevStateRef.current;
    if (!prev || !me) { prevStateRef.current = state; return; }
    const prevMe = prev.players.find(p => p.id === myId);
    if (!prevMe) { prevStateRef.current = state; return; }

    const totalCards  = s => (s.slots || []).reduce((a, sl) => a + sl.size, 0);
    const myCards     = totalCards(me);
    const prevMyCards = totalCards(prevMe);

    if (myCards > prevMyCards && state.currentPlayerId === myId) {
      const oppLost = prev.players.filter(p => p.id !== myId).some(p => {
        const cur = state.players.find(pp => pp.id === p.id);
        return cur && (cur.lastSlotTop?.size ?? 0) < (p.lastSlotTop?.size ?? 0);
      });
      if (oppLost) { ach.onSteal(); sfx.steal(); }
      else sfx.pair();
    }
    if (myCards < prevMyCards && state.currentPlayerId !== myId) {
      ach.onStolenFrom(); sfx.stolenFrom();
    }

    const meLocked   = (me.slots     || []).filter(s => s.locked).length;
    const prevLocked = (prevMe.slots || []).filter(s => s.locked).length;
    if (meLocked > prevLocked) { ach.onLock(meLocked >= 3); sfx.lock(); }

    const curSafe  = (me.slots     || []).filter(s => s.isSafe).length;
    const prevSafe = (prevMe.slots || []).filter(s => s.isSafe).length;
    if (curSafe > prevSafe) ach.onSafeLock();

    prevStateRef.current = state;
  }, [state, myId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function act(action, msg) {
    socket.emit('game_action', action, res => {
      if (!res.ok) { showErr(res.error); return; }
      setSel(null);
      if (action.type === 'DROP') sfx.drop();
      if (msg) { setFeedback(msg); setTimeout(() => setFeedback(''), 2600); }
    });
  }
  function showErr(msg) { setErr(msg); setTimeout(() => setErr(''), 3000); }
  function pick(card)   { if (!isMyTurn) return; setSel(prev => prev?.id === card.id ? null : card); }

  // ── Interaction flags ─────────────────────────────────────────────────────
  const canFloor   = c   => isMyTurn && !!sel && c.rank === sel.rank;
  // PAIR_OWN only valid if the last collected slot is NOT locked and top card matches
  const canPairOwn = lastSlot && !lastSlot.locked && isMyTurn && !!sel && lastSlot.topCard?.rank === sel.rank;
  // Steal requires rank match AND the opponent's last slot is not locked
  const canSteal   = top => isMyTurn && !!sel && !top?.locked && top?.topCard?.rank === sel.rank;

  // ── Derived display ───────────────────────────────────────────────────────
  const currentName    = state.players.find(p => p.id === state.currentPlayerId)?.name;
  const totalHandCards = state.players.reduce((s, p) => s + p.handCount, 0);
  const phaseTag       = state.phase === 'endgame' ? `⚡ ENDGAME` : null;

  if (state.phase === 'finished') {
    if (!gameOverSfxDone.current) {
      gameOverSfxDone.current = true;
      const winner = [...state.players].sort((a, b) => b.score - a.score)[0];
      if (winner?.id === myId) sfx.win(); else sfx.lose();
    }
    return <GameOver players={state.players} myId={myId} highscores={highscores} />;
  }

  return (
    <div className="g-root">
      <AchievementToast toasts={ach.toasts} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="g-bar">
        <span className="g-bar-brand">♠ DAKETI</span>
        <span className="g-bar-room">Room <strong>{state.roomId}</strong></span>
        {phaseTag && <span className="g-bar-phase">{phaseTag}</span>}
        <div className="g-bar-right">
          <div className={`turn-pill ${isMyTurn ? 'turn-pill--mine' : ''}`}>
            {isMyTurn ? '⭐ Your Turn' : `${currentName}'s turn`}
          </div>
          <button className="icon-btn leave-btn" onClick={onLeave} title="Leave game">✕ Leave</button>
          {!voice.active ? (
            <button className="icon-btn" onClick={voice.join} title="Join voice chat">🎤</button>
          ) : (
            <>
              <button
                className={`icon-btn mic-btn ${voice.micMuted ? 'mic-btn--muted' : voice.talking ? 'mic-btn--talking' : 'mic-btn--on'}`}
                onClick={voice.toggleMic}
                title={voice.micMuted ? 'Unmute mic' : 'Mute mic'}
              >{voice.micMuted ? '🔇' : '🎙️'}</button>
              <button
                className={`icon-btn ${voice.speakerMuted ? 'mic-btn--muted' : 'mic-btn--on'}`}
                onClick={voice.toggleSpeaker}
                title={voice.speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
              >{voice.speakerMuted ? '🔕' : '🔊'}</button>
              <button className="icon-btn" onClick={voice.leave} title="Leave voice">📵</button>
            </>
          )}
          {voice.error && <span className="voice-err">{voice.error}</span>}
          <button className={`icon-btn ${chatOpen?'icon-btn--active':''}`}
            onClick={() => setChatOpen(v => !v)} title="Chat">💬</button>
        </div>
      </header>

      {(err || feedback) && (
        <div className={`g-strip ${err ? 'g-strip--err' : 'g-strip--ok'}`}>{err || feedback}</div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="g-body">

        <div className="g-table">

          {isMyTurn && (
            <div className="g-hint">
              {sel
                ? <><strong className="hint-card">{sel.rank} {SUIT[sel.suit]}</strong> — tap a floor card to pair · your latest stack · an opponent's card · or Drop</>
                : <>Your turn — tap a hand card to select</>
              }
            </div>
          )}
          {state.phase === 'endgame' && (
            <div className="endgame-banner">
              ⚡ ENDGAME — 1 move per turn until all hands are empty
            </div>
          )}

          {/* ── Opponents ────────────────────────────────────────────── */}
          <div className="g-opps">
            {others.map(p => {
              const isCur = p.id === state.currentPlayerId;
              const steal = p.lastSlotTop && canSteal(p.lastSlotTop);
              return (
                <div key={p.id} className={`opp ${isCur ? 'opp--active' : ''}`}>
                  <div className="opp-head">
                    <div className="opp-av">{p.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="opp-nm">
                        <span className="opp-score-inline">{p.currentScore}</span>
                        {p.name}{isCur && <span className="live-dot"/>}
                      </div>
                      <div className="opp-meta">
                        {p.lockedSetCount > 0 && <span>🔒×{p.lockedSetCount}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="opp-hand-pile">
                    {Array.from({ length: Math.min(p.handCount, 5) }).map((_, i) => (
                      <div key={i} className="opp-facedown" style={{ marginLeft: i * 10 }}>
                        <div className="tc tc-back opp-back"><div className="tc-pat"/></div>
                      </div>
                    ))}
                  </div>

                  {/* Always show top card of last collected slot; lock badge if not stealable */}
                  {p.lastSlotTop && (
                    <div
                      className={`opp-topcard ${steal ? 'opp-topcard--steal' : ''}`}
                      onClick={() => steal && act(
                        { type:'STEAL', handCardId: sel.id, targetPlayerId: p.id },
                        'Stolen!'
                      )}
                    >
                      <TableCard
                        card={p.lastSlotTop.topCard}
                        glow={steal} pulsing={steal}
                        locked={p.lastSlotTop.locked}
                      />
                      {steal && <span className="steal-cta">STEAL!</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Felt ─────────────────────────────────────────────────── */}
          <div className="g-felt">
            <span className="felt-corner felt-corner--tl fs-b" aria-hidden>♠</span>
            <span className="felt-corner felt-corner--tr fs-r" aria-hidden>♥</span>
            <span className="felt-corner felt-corner--bl fs-r" aria-hidden>♦</span>
            <span className="felt-corner felt-corner--br fs-b" aria-hidden>♣</span>
            <div className="felt-row">
              <div className="felt-col">
                <div className="felt-lbl">FLOOR</div>
                <div className="floor-cards">
                  {state.floor.length === 0
                    ? <span className="felt-empty">empty</span>
                    : state.floor.map(c => (
                        <TableCard key={c.id} card={c} glow={canFloor(c)}
                          onClick={() => canFloor(c) && act(
                            { type:'PAIR', handCardId: sel.id, floorCardId: c.id },
                            'Pair! Keep going or drop.'
                          )}
                        />
                      ))
                  }
                </div>
              </div>
              <div className="felt-div" />
              <div className="felt-col">
                <div className="felt-lbl">DECK</div>
                <div className="deck-zone">
                  {state.deckCount > 0
                    ? <DeckCard count={state.deckCount} />
                    : <span className="felt-empty">empty</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* ── My area ──────────────────────────────────────────────── */}
          <div className="g-me">

            {/* All slots in chronological order — locked and active interleaved */}
            {me?.slots?.length > 0 && (
              <div className="my-stacks-row">
                <div className="my-stacks">
                  {me.slots.map((slot, i) => {
                    // "Last" = the actual last collected slot (last index).
                    // Only this one is stealable / PAIR_OWN-able, and only when unlocked.
                    const isLast     = i === me.slots.length - 1;
                    const pairActive = isLast && !slot.locked && !!canPairOwn;

                    if (slot.locked) {
                      return (
                        <div key={i} className="my-stack my-stack--locked"
                          title="Locked — cannot be stolen">
                          <TableCard card={slot.topCard} locked />
                          <span className="st-sz">🔒×{slot.size}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className={[
                          'my-stack',
                          pairActive                    ? 'my-stack--pair'   : '',
                          isLast && !pairActive         ? 'my-stack--latest' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => pairActive && act({ type:'PAIR_OWN', handCardId: sel.id }, 'Added to stack!')}
                        title={isLast ? 'Most recent — can be stolen' : ''}
                      >
                        <TableCard card={slot.topCard} glow={pairActive} />
                        <span className="st-sz">×{slot.size}</span>
                        {pairActive && <span className="st-action-tag">+PAIR</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hand */}
            <div className="hand-label-row">
              <span className="hand-lbl">Your Hand</span>
              <span className="hand-count">{me?.hand?.length ?? 0} cards</span>
              <span className="hand-score">{me?.currentScore ?? 0} pts</span>
            </div>
            <div className="hand-row">
              {me?.hand?.map(c => (
                <HandCard key={c.id} card={c}
                  selected={sel?.id === c.id}
                  canPlay={isMyTurn}
                  isNew={c.id === newId}
                  onClick={() => pick(c)}
                />
              ))}
            </div>

            {/* Drop */}
            {isMyTurn && (
              <div className="drop-zone">
                <button
                  className={`btn-drop ${sel ? 'btn-drop--ready' : ''}`}
                  disabled={!sel}
                  onClick={() => sel && act({ type:'DROP', handCardId: sel.id }, '')}
                >
                  Drop &amp; End Turn
                </button>
                {!sel && <span className="drop-tip">Select a card first</span>}
              </div>
            )}
          </div>

        </div>

        <Chat messages={chatMessages} myId={myId} open={chatOpen} onToggle={() => setChatOpen(v => !v)} />
      </div>
    </div>
  );
}
