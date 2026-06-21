import { useEffect, useState } from 'react';
import socket from './socket.js';
import Lobby from './components/Lobby.jsx';
import Game  from './components/Game.jsx';

export default function App() {
  const [state,      setState]      = useState(null);
  const [myId,       setMyId]       = useState(null);
  const [chatMsgs,   setChatMsgs]   = useState([]);
  const [highscores, setHighscores] = useState([]);

  useEffect(() => {
    socket.on('connect',      () => setMyId(socket.id));
    socket.on('game_state',   s  => setState(s));
    socket.on('chat_message', m  => setChatMsgs(prev => [...prev, m]));
    socket.on('highscores',   hs => setHighscores(hs));
    return () => {
      socket.off('connect');
      socket.off('game_state');
      socket.off('chat_message');
      socket.off('highscores');
    };
  }, []);

  function handleJoined(initialState) {
    setMyId(socket.id);
    setState(initialState);
    // Pre-load existing highscores
    socket.emit('get_highscores', {}, res => {
      if (res?.ok) setHighscores(res.scores);
    });
  }

  // ── Waiting room ───────────────────────────────────────────────────────────
  if (state?.phase === 'lobby') {
    const isHost = state.hostId === myId;
    return (
      <div className="lobby">
        <div className="lobby-card">
          <div className="lobby-room-code">{state.roomId}</div>
          <p className="lobby-share">Share this code with friends to join</p>
          <ul className="lobby-players">
            {state.players.map(p => (
              <li key={p.id} className={p.id === myId ? 'lp-me' : ''}>
                <span className="lp-avatar">{p.name[0]?.toUpperCase()}</span>
                {p.name} {p.id === state.hostId ? '👑' : ''}
              </li>
            ))}
          </ul>
          {isHost
            ? <button
                className="btn-gold"
                disabled={state.players.length < 2}
                onClick={() => socket.emit('start_game', {}, res => { if (!res.ok) alert(res.error); })}
              >
                {state.players.length < 2 ? 'Waiting for players…' : 'Start Game'}
              </button>
            : <p className="lobby-wait">Waiting for host to start…</p>
          }
        </div>
      </div>
    );
  }

  if (state && state.phase !== 'lobby') {
    return <Game state={state} myId={myId} chatMessages={chatMsgs} highscores={highscores} />;
  }

  return <Lobby onJoined={handleJoined} />;
}
