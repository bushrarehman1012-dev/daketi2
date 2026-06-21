import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';
import Chat from './Chat.jsx';
import { useVoiceChat } from '../hooks/useVoiceChat.js';
import { useAchievements, AchievementToast } from './AchievementToast.jsx';

const SUIT = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED  = new Set(['hearts', 'diamonds']);

// ── Deck card with thief logo ─────────────────────────────────────────────────

function DeckCard({ count }) {
  // Miniature of the same crouching-thief-with-sack silhouette
  const G = '#D4AF37';
  return (
    <div className="deck-card">
      <svg className="deck-thief" viewBox="0 0 88 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dcHS" width="88" height="7" patternUnits="userSpaceOnUse">
            <rect width="88" height="3.5" fill="transparent"/>
            <rect y="3.5" width="88" height="3.5" fill="rgba(7,13,32,0.72)"/>
          </pattern>
        </defs>
        <g fill={G}>
          {/* Sack */}
          <ellipse cx="64" cy="42" rx="24" ry="22"/>
          {/* Sack tie + knot */}
          <ellipse cx="50" cy="22" rx="6" ry="4" transform="rotate(-20 50 22)"/>
          <circle cx="49" cy="17" r="4"/>
          {/* Head */}
          <circle cx="20" cy="20" r="11"/>
          {/* Beanie dome */}
          <path d="M9 22 Q9 4 20 2 Q31 4 31 22 Q25 18 20 17 Q15 18 9 22Z"/>
          {/* Neck + torso (crouched) */}
          <ellipse cx="28" cy="30" rx="5" ry="9" transform="rotate(60 28 30)"/>
          <ellipse cx="33" cy="44" rx="11" ry="20" transform="rotate(22 33 44)"/>
          {/* Arm gripping sack */}
          <ellipse cx="45" cy="30" rx="6" ry="15" transform="rotate(-55 45 30)"/>
          <circle cx="51" cy="25" r="6"/>
          {/* Hip */}
          <circle cx="30" cy="59" r="9"/>
          {/* Front leg */}
          <ellipse cx="23" cy="64" rx="7" ry="13" transform="rotate(25 23 64)"/>
          <ellipse cx="14" cy="75" rx="5" ry="9" transform="rotate(-12 14 75)"/>
          {/* Back leg */}
          <ellipse cx="36" cy="65" rx="6" ry="11" transform="rotate(-18 36 65)"/>
        </g>
        {/* Stripe overlay on torso + arm */}
        <ellipse cx="33" cy="44" rx="11" ry="20" transform="rotate(22 33 44)" fill="url(#dcHS)"/>
        <ellipse cx="45" cy="30" rx="6" ry="15" transform="rotate(-55 45 30)" fill="url(#dcHS)"/>
      </svg>
      <div className="deck-count">{count}</div>
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
      <span className="hc-big">{SUIT[card.suit]}</span>
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

export default function Game({ state, myId, chatMessages, highscores }) {
  const [sel,      setSel]      = useState(null);
  const [feedback, setFeedback] = useState('');
  const [err,      setErr]      = useState('');
  const [newId,    setNewId]    = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const prevHandRef  = useRef([]);
  const prevStateRef = useRef(null);

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
    if (drew) { setNewId(drew.id); setTimeout(() => setNewId(null), 800); }
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
      if (oppLost) ach.onSteal();
    }
    if (myCards < prevMyCards && state.currentPlayerId !== myId) ach.onStolenFrom();

    const meLocked   = (me.slots     || []).filter(s => s.locked).length;
    const prevLocked = (prevMe.slots || []).filter(s => s.locked).length;
    if (meLocked > prevLocked) ach.onLock(meLocked >= 3);

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
  const phaseTag       = state.phase === 'endgame'
    ? `⚡ ENDGAME · ${totalHandCards} cards left`
    : `🂠 ${state.deckCount} in deck`;

  if (state.phase === 'finished') {
    return <GameOver players={state.players} myId={myId} highscores={highscores} />;
  }

  return (
    <div className="g-root">
      <AchievementToast toasts={ach.toasts} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="g-bar">
        <span className="g-bar-brand">♠ DAKETI</span>
        <span className="g-bar-room">Room <strong>{state.roomId}</strong></span>
        <span className="g-bar-phase">{phaseTag}</span>
        <div className="g-bar-right">
          <div className={`turn-pill ${isMyTurn ? 'turn-pill--mine' : ''}`}>
            {isMyTurn ? '⭐ Your Turn' : `${currentName}'s turn`}
          </div>
          <button
            className={`icon-btn mic-btn ${voice.active?'mic-btn--on':''} ${voice.talking?'mic-btn--talking':''}`}
            onClick={voice.toggle}
            title={voice.active ? 'Leave voice' : 'Join voice chat'}
          >{voice.active ? '🎙️' : '🎤'}</button>
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

        <ScorePanel players={state.players} myId={myId} currentPlayerId={state.currentPlayerId} />

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
                    <div>
                      <div className="opp-nm">{p.name}{isCur && <span className="live-dot"/>}</div>
                      <div className="opp-meta">
                        {p.lockedSetCount > 0 && <span>🔒×{p.lockedSetCount}</span>}
                        <span className="opp-score-badge">{p.currentScore}pt</span>
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
            <div className="felt-suits" aria-hidden>
              <span className="fs fs-b">♠</span>
              <span className="fs fs-r">♦</span>
              <span className="fs fs-b">♣</span>
              <span className="fs fs-r">♥</span>
            </div>
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
