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
      {/* Front-facing thief bust — same character as the lobby logo, cropped to head+hat+coat top */}
      <svg className="deck-thief" viewBox="8 0 180 168" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dcHS" width="200" height="12" patternUnits="userSpaceOnUse">
            <rect width="200" height="6" fill="transparent"/>
            <rect y="6" width="200" height="6" fill="rgba(7,13,32,0.56)"/>
          </pattern>
        </defs>
        {/* TOP HAT */}
        <ellipse cx="120" cy="57" rx="56" ry="10" fill="#D4AF37"/>
        <path d="M76 57 L80 8 L160 8 L164 57Z" fill="#D4AF37"/>
        <path d="M142 10 L164 57 L155 57 L135 10Z" fill="rgba(0,0,0,0.1)"/>
        <rect x="79" y="46" width="82" height="10" rx="2" fill="#070d20"/>
        <rect x="80" y="49" width="80" height="3.5" rx="1.5" fill="#D4AF37" opacity=".28"/>
        {/* HEAD */}
        <circle cx="120" cy="99" r="36" fill="#D4AF37"/>
        {/* DOMINO MASK */}
        <path d="M84 92 Q120 82 156 92 L154 104 Q120 114 86 104Z" fill="#070d20"/>
        <ellipse cx="103" cy="97" rx="10" ry="7.5" fill="#D4AF37"/>
        <ellipse cx="137" cy="97" rx="10" ry="7.5" fill="#D4AF37"/>
        <circle cx="107" cy="98" r="5" fill="#070d20"/>
        <circle cx="141" cy="98" r="5" fill="#070d20"/>
        <circle cx="108.5" cy="96.5" r="1.8" fill="rgba(255,255,255,0.62)"/>
        <circle cx="142.5" cy="96.5" r="1.8" fill="rgba(255,255,255,0.62)"/>
        {/* SMIRK */}
        <path d="M108 119 Q120 129 132 119" stroke="#8a6c08" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* SCARF */}
        <path d="M86 112 Q120 104 154 112 Q151 128 120 132 Q89 128 86 112Z" fill="#9a7c10"/>
        <rect x="112" y="130" width="16" height="12" fill="#D4AF37"/>
        {/* COAT top */}
        <path d="M64 143 L52 170 L188 170 L176 143 Q120 128 64 143Z" fill="#D4AF37"/>
        <path d="M64 143 L52 170 L188 170 L176 143 Q120 128 64 143Z" fill="url(#dcHS)"/>
        <path d="M120 143 L100 165 L120 158Z" fill="#9a7c10"/>
        <path d="M120 143 L140 165 L120 158Z" fill="#9a7c10"/>
        {/* LEFT ARM raised with cards */}
        <path d="M64 151 L18 63 L34 53 L80 144Z" fill="#D4AF37"/>
        <path d="M64 151 L18 63 L34 53 L80 144Z" fill="url(#dcHS)"/>
        <circle cx="20" cy="57" r="15" fill="#D4AF37"/>
        <g transform="translate(26,33)">
          <g transform="rotate(-32)">
            <rect x="-10" y="-30" width="20" height="28" rx="3.5" fill="#1a3a8c" stroke="#5a8ade" strokeWidth="1.2"/>
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
      </svg>
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

function CardCenter({ rank, suit }) {
  const sym  = SUIT[suit];
  const pips = PIP_POS[rank];

  if (!pips) return (
    <div className="hc-face">
      <span className="hc-face-initial">{rank}</span>
      <span className="hc-face-sym">{sym}</span>
    </div>
  );

  const n  = pips.length;
  const fs = n <= 1 ? 22 : n <= 4 ? 16 : n <= 6 ? 14 : 12;
  return (
    <div className="hc-pips">
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
      <CardCenter rank={card.rank} suit={card.suit} />
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
      <span className="tc-rank">{card.rank}</span>
      <span className="tc-suit">{SUIT[card.suit]}</span>
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
