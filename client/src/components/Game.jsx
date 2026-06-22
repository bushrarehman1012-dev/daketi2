import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';
import Chat from './Chat.jsx';
import { useVoiceChat } from '../hooks/useVoiceChat.js';
import { useAchievements, AchievementToast } from './AchievementToast.jsx';
import { sfx } from '../utils/sounds.js';

const SUIT = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED  = new Set(['hearts', 'diamonds']);

// ── Card Back — CSS design that scales cleanly at any card size ───────────────
function CardBack({ withThief = false }) {
  return (
    <div className="cbk">
      <div className="cbk-inner">
        <span className="cbk-c cbk-tl">♠</span>
        <span className="cbk-c cbk-tr">♥</span>
        {withThief
          ? <img src="/card-back-hero.jpg" className="cbk-thief" alt="" />
          : <span className="cbk-spade">♠</span>
        }
        <span className="cbk-c cbk-bl">♦</span>
        <span className="cbk-c cbk-br">♣</span>
      </div>
    </div>
  );
}

// ── Deck card — large branded card with thief image ───────────────────────────
function DeckCard({ count }) {
  return (
    <div className="deck-card">
      <CardBack withThief />
      <div className="deck-count">{count}</div>
    </div>
  );
}

// ── Pip positions [x%, y%] within pip container ───────────────────────────────
// y within 14–86% so pips never overlap corner labels
const PIP_POS = {
  'A':  [[50,50]],
  '2':  [[50,19],[50,81]],
  '3':  [[50,15],[50,50],[50,85]],
  '4':  [[28,22],[72,22],[28,78],[72,78]],
  '5':  [[28,22],[72,22],[50,50],[28,78],[72,78]],
  '6':  [[28,19],[72,19],[28,50],[72,50],[28,81],[72,81]],
  '7':  [[28,17],[72,17],[50,34],[28,55],[72,55],[28,77],[72,77]],
  '8':  [[28,15],[72,15],[50,32],[28,50],[72,50],[50,68],[28,85],[72,85]],
  '9':  [[28,14],[72,14],[28,36],[72,36],[50,50],[28,64],[72,64],[28,86],[72,86]],
  '10': [[28,14],[72,14],[50,29],[28,43],[72,43],[28,57],[72,57],[50,71],[28,86],[72,86]],
};

// Portrait illustration for top-half of a face card (56 × 25 SVG units)
function Portrait({ rank, isRed }) {
  const skin      = '#F5C598';
  const hairDark  = '#3a1a00';
  const robeColor = isRed ? '#8B0000' : '#1a1a6a';
  const trimColor = isRed ? '#c84040' : '#3a3aaa';

  if (rank === 'K') return (
    <g>
      <path d="M18 9 L21 3 L25 7 L28 2 L31 7 L35 3 L38 9 L36 11 L20 11Z" fill="#D4AF37" stroke="#8a6000" strokeWidth=".5"/>
      <ellipse cx="28" cy="11" rx="10" ry="2.2" fill="#D4AF37" stroke="#8a6000" strokeWidth=".4"/>
      <circle cx="25" cy="5.5" r="1.2" fill="#CC1111"/>
      <circle cx="28" cy="4" r="1.2" fill="#CC1111"/>
      <circle cx="31" cy="5.5" r="1.2" fill="#CC1111"/>
      <ellipse cx="28" cy="17" rx="8" ry="8.5" fill={skin} stroke="#c8a070" strokeWidth=".4"/>
      <path d="M22 13 Q25 11.5 27.5 13" stroke={hairDark} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <path d="M28.5 13 Q31 11.5 34 13" stroke={hairDark} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <ellipse cx="24.8" cy="15" rx="2.2" ry="1.6" fill="white"/>
      <circle cx="25.1" cy="15" r="1.2" fill="#1a0a00"/>
      <circle cx="25.5" cy="14.4" r=".45" fill="white"/>
      <ellipse cx="31.2" cy="15" rx="2.2" ry="1.6" fill="white"/>
      <circle cx="31.5" cy="15" r="1.2" fill="#1a0a00"/>
      <circle cx="31.9" cy="14.4" r=".45" fill="white"/>
      <path d="M27 19 Q28 20.5 29 19" stroke="#c09060" strokeWidth=".9" fill="none" strokeLinecap="round"/>
      <path d="M21 21 Q24 19.5 28 21 Q32 19.5 35 21" fill={hairDark} stroke={hairDark} strokeWidth=".4"/>
      <path d="M20 22 Q24 20 28 22 Q32 20 36 22 Q33 26 28 27 Q23 26 20 22Z" fill={hairDark}/>
      <path d="M13 25 Q20 22 28 21.5 Q36 22 43 25Z" fill={robeColor}/>
      <path d="M23 25 L26 21.5 M33 25 L30 21.5" stroke={trimColor} strokeWidth=".8"/>
    </g>
  );

  if (rank === 'Q') return (
    <g>
      <path d="M20 9 L22 4 L26 7.5 L28 3 L30 7.5 L34 4 L36 9 L34 11 L22 11Z" fill="#D4AF37" stroke="#8a6000" strokeWidth=".5"/>
      <ellipse cx="28" cy="11" rx="8.5" ry="2" fill="#D4AF37" stroke="#8a6000" strokeWidth=".4"/>
      <circle cx="25" cy="6" r="1.1" fill="#9900CC"/>
      <circle cx="28" cy="4.5" r="1.1" fill="#9900CC"/>
      <circle cx="31" cy="6" r="1.1" fill="#9900CC"/>
      <ellipse cx="19" cy="19" rx="4.5" ry="9" fill={hairDark}/>
      <ellipse cx="37" cy="19" rx="4.5" ry="9" fill={hairDark}/>
      <ellipse cx="28" cy="17" rx="7.5" ry="8" fill={skin} stroke="#c8a070" strokeWidth=".4"/>
      <path d="M22.5 13 Q25 11.5 27 13" stroke={hairDark} strokeWidth="1" fill="none" strokeLinecap="round"/>
      <path d="M29 13 Q31 11.5 33.5 13" stroke={hairDark} strokeWidth="1" fill="none" strokeLinecap="round"/>
      <ellipse cx="24.5" cy="15" rx="2" ry="1.5" fill="white"/>
      <circle cx="24.8" cy="15" r="1.1" fill="#2a0050"/>
      <circle cx="25.2" cy="14.4" r=".4" fill="white"/>
      <path d="M22.5 13.5 L23 12.5 M24.5 13 L24.5 12 M26.5 13.5 L26 12.5" stroke={hairDark} strokeWidth=".8" strokeLinecap="round"/>
      <ellipse cx="31.5" cy="15" rx="2" ry="1.5" fill="white"/>
      <circle cx="31.8" cy="15" r="1.1" fill="#2a0050"/>
      <circle cx="32.2" cy="14.4" r=".4" fill="white"/>
      <path d="M29.5 13.5 L30 12.5 M31.5 13 L31.5 12 M33.5 13.5 L33 12.5" stroke={hairDark} strokeWidth=".8" strokeLinecap="round"/>
      <path d="M27.2 18.5 Q28 20 28.8 18.5" stroke="#c09060" strokeWidth=".8" fill="none" strokeLinecap="round"/>
      <path d="M24.5 22 Q28 24 31.5 22" stroke="#c06080" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M24.5 22 Q28 20.5 31.5 22" stroke="#e08090" strokeWidth=".7" fill="none" strokeLinecap="round"/>
      <path d="M14 25 Q21 22.5 28 22 Q35 22.5 42 25Z" fill={robeColor}/>
      <path d="M22 25 L25 22.5 M34 25 L31 22.5" stroke={trimColor} strokeWidth=".8"/>
    </g>
  );

  // Jack
  return (
    <g>
      <ellipse cx="28" cy="10" rx="13" ry="2.5" fill={robeColor}/>
      <path d="M16 10 Q18 5 28 4 Q38 5 40 10Z" fill={robeColor}/>
      <path d="M39 8 Q46 2 48 6 Q45 9 40 11Z" fill={isRed ? '#ff6060' : '#6080ff'} opacity=".85"/>
      <path d="M39 8 Q44 4 46 7" stroke="rgba(255,255,255,.4)" strokeWidth=".7" fill="none" strokeLinecap="round"/>
      <path d="M17 10 Q20 8 22 11" stroke={hairDark} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      <path d="M34 11 Q36 8 39 10" stroke={hairDark} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      <ellipse cx="28" cy="17.5" rx="7" ry="7.5" fill={skin} stroke="#c8a070" strokeWidth=".4"/>
      <path d="M23 14 Q25.5 12.5 27.5 13.5" stroke={hairDark} strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <path d="M28.5 13.5 Q30.5 12.5 33 14" stroke={hairDark} strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <ellipse cx="25" cy="16" rx="2" ry="1.5" fill="white"/>
      <circle cx="25.3" cy="16" r="1.1" fill="#1a2848"/>
      <circle cx="25.7" cy="15.3" r=".4" fill="white"/>
      <ellipse cx="31" cy="16" rx="2" ry="1.5" fill="white"/>
      <circle cx="31.3" cy="16" r="1.1" fill="#1a2848"/>
      <circle cx="31.7" cy="15.3" r=".4" fill="white"/>
      <path d="M27.2 19.5 Q28 21 28.8 19.5" stroke="#c09060" strokeWidth=".8" fill="none" strokeLinecap="round"/>
      <path d="M24.5 22.5 Q28 24.5 31.5 23" stroke="#8a4030" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M15 25 Q22 22.5 28 22 Q34 22.5 41 25Z" fill={robeColor}/>
      <path d="M24 25 Q26 22 28 24 Q30 22 32 25" stroke={trimColor} strokeWidth=".9" fill="none"/>
    </g>
  );
}

// Two-headed face card — always SVG, same design at both hand and table scale
function FaceCard({ rank, suit, small = false }) {
  const isRed = RED.has(suit);
  const c     = isRed ? '#C80000' : '#111111';
  return (
    <svg
      className={small ? 'tc-face-svg' : 'hc-face-svg'}
      viewBox="0 0 56 50" fill="none" xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="54" height="48" rx="3" stroke={c} strokeWidth=".4" opacity=".15"/>
      <Portrait rank={rank} isRed={isRed} />
      <line x1="4" y1="25" x2="52" y2="25" stroke={c} strokeWidth=".6" opacity=".2"/>
      <g transform="translate(56,50) rotate(180)">
        <Portrait rank={rank} isRed={isRed} />
      </g>
    </svg>
  );
}

function CardPips({ rank, suit, small = false }) {
  const sym  = SUIT[suit];
  const pips = PIP_POS[rank];
  if (!pips) return <FaceCard rank={rank} suit={suit} small={small} />;

  const n = pips.length;
  const fs = n <= 1 ? '2.1em'
           : n <= 4 ? '1.1em'
           : n <= 6 ? '.95em'
           : n <= 8 ? '.80em'
           :          '.70em';

  return (
    <div className={small ? 'tc-pips' : 'hc-pips'}>
      {pips.map(([x, y], i) => (
        <span key={i} className="hc-pip" style={{
          left: `${x}%`, top: `${y}%`, fontSize: fs,
          transform: `translate(-50%,-50%)${y > 50 ? ' rotate(180deg)' : ''}`,
        }}>{sym}</span>
      ))}
    </div>
  );
}

// ── Card components ───────────────────────────────────────────────────────────

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
  if (faceDown) return <div className="tc tc-back"><CardBack /></div>;
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
  const [sel,       setSel]      = useState(null);
  const [feedback,  setFeedback] = useState('');
  const [err,       setErr]      = useState('');
  const [newId,     setNewId]    = useState(null);
  const [chatOpen,  setChatOpen] = useState(false);
  const [hintToast, setHintToast] = useState('');

  const prevHandRef  = useRef([]);
  const hintTimerRef = useRef(null);
  const prevStateRef    = useRef(null);
  const gameOverSfxDone = useRef(false);

  const voice = useVoiceChat(myId);
  const ach   = useAchievements();

  const me       = state.players.find(p => p.id === myId);
  const isMyTurn = state.currentPlayerId === myId;
  const others   = state.players.filter(p => p.id !== myId);
  const lastSlot = me?.slots?.at(-1) ?? null;

  useEffect(() => {
    if (!me?.hand) return;
    const prev = new Set(prevHandRef.current.map(c => c.id));
    const drew = me.hand.find(c => !prev.has(c.id));
    if (drew) { setNewId(drew.id); setTimeout(() => setNewId(null), 800); sfx.deal(); }
    prevHandRef.current = me.hand;
  }, [me?.hand]);

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

  function act(action, msg) {
    socket.emit('game_action', action, res => {
      if (!res.ok) { showErr(res.error); return; }
      setSel(null);
      if (action.type === 'DROP') sfx.drop();
      if (msg) { setFeedback(msg); setTimeout(() => setFeedback(''), 2600); }
    });
  }
  function showErr(msg) { setErr(msg); setTimeout(() => setErr(''), 3000); }
  function pick(card) {
    if (!isMyTurn) return;
    const next = sel?.id === card.id ? null : card;
    setSel(next);
    if (next) {
      const msg = `${next.rank} ${SUIT[next.suit]} selected — pair to floor · stack · steal · or Drop`;
      setHintToast(msg);
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setHintToast(''), 2200);
    }
  }

  const canFloor   = c   => isMyTurn && !!sel && c.rank === sel.rank;
  const canPairOwn = lastSlot && !lastSlot.locked && isMyTurn && !!sel && lastSlot.topCard?.rank === sel.rank;
  const canSteal   = top => isMyTurn && !!sel && !top?.locked && top?.topCard?.rank === sel.rank;

  const currentName = state.players.find(p => p.id === state.currentPlayerId)?.name;
  const phaseTag    = state.phase === 'endgame' ? '⚡ ENDGAME' : null;

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
          <button className="icon-btn leave-btn" onClick={onLeave} title="Leave game">✕</button>

          {/* Chat — always visible, always same position */}
          <button
            className={`icon-btn ${chatOpen ? 'icon-btn--active' : ''}`}
            onClick={() => setChatOpen(v => !v)}
            title="Chat"
          >💬</button>

          {/* Voice — always exactly 3 buttons so header width never changes */}
          <button
            className={`icon-btn vbtn ${!voice.active ? 'vbtn--off' : voice.micMuted ? 'mic-btn--muted' : voice.talking ? 'mic-btn--talking' : 'mic-btn--on'}`}
            onClick={voice.active ? voice.toggleMic : voice.join}
            title={!voice.active ? 'Join voice' : voice.micMuted ? 'Unmute mic' : 'Mute mic'}
          >{!voice.active ? '🎤' : voice.micMuted ? '🔇' : '🎙️'}</button>
          <button
            className={`icon-btn vbtn ${!voice.active ? 'vbtn--off' : voice.speakerMuted ? 'mic-btn--muted' : 'mic-btn--on'}`}
            onClick={() => voice.active && voice.toggleSpeaker()}
            title={voice.speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
          >{voice.speakerMuted ? '🔕' : '🔊'}</button>
          <button
            className={`icon-btn vbtn ${!voice.active ? 'vbtn--off' : 'vbtn--leave'}`}
            onClick={() => voice.active && voice.leave()}
            title="Leave voice"
          >📵</button>
        </div>
      </header>

      {/* Floating toasts — no layout space consumed */}
      {(err || feedback) && (
        <div className={`game-toast ${err ? 'game-toast--err' : 'game-toast--ok'}`}>
          {err || feedback}
        </div>
      )}
      {hintToast && (
        <div className="game-toast game-toast--hint">{hintToast}</div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="g-body">
        <div className="g-table">

          {/* Turn status — always same height, no content that can shift layout */}
          <div className={`g-hint ${!isMyTurn ? 'g-hint--idle' : ''}`}>
            {isMyTurn ? <>Your turn — tap a hand card to select</> : <>{currentName}&apos;s turn…</>}
          </div>

          {state.phase === 'endgame' && (
            <div className="endgame-banner">⚡ ENDGAME — 1 move per turn until all hands empty</div>
          )}

          {/* ── Opponents ──────────────────────────────────────────────── */}
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
                        <div className="tc tc-back opp-back"><CardBack /></div>
                      </div>
                    ))}
                  </div>

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

          {/* ── Felt ───────────────────────────────────────────────────── */}
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

          {/* ── My area ────────────────────────────────────────────────── */}
          <div className="g-me">
            {me?.slots?.length > 0 && (
              <div className="my-stacks-row">
                <div className="my-stacks">
                  {me.slots.map((slot, i) => {
                    const isLast     = i === me.slots.length - 1;
                    const pairActive = isLast && !slot.locked && !!canPairOwn;
                    if (slot.locked) {
                      return (
                        <div key={i} className="my-stack my-stack--locked" title="Locked">
                          <TableCard card={slot.topCard} locked />
                          <span className="st-sz">🔒×{slot.size}</span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className={['my-stack', pairActive ? 'my-stack--pair' : '', isLast && !pairActive ? 'my-stack--latest' : ''].filter(Boolean).join(' ')}
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
