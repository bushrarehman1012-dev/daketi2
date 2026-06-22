import { useEffect, useState } from 'react';
import socket from './socket.js';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage    from './components/AuthPage.jsx';
import Lobby       from './components/Lobby.jsx';
import Game        from './components/Game.jsx';
import ProfileModal from './components/ProfileModal.jsx';

export default function App() {
  const { user, loading, getToken } = useAuth();
  const [asGuest,      setAsGuest]      = useState(false);
  const [showProfile,  setShowProfile]  = useState(false);
  const [state,        setState]        = useState(null);
  const [myId,         setMyId]         = useState(null);
  const [chatMsgs,     setChatMsgs]     = useState([]);
  const [highscores,   setHighscores]   = useState([]);
  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [invite,       setInvite]       = useState(null);

  // When the user logs in, pass the JWT to the socket so the server can link
  // this connection to their account.
  useEffect(() => {
    if (!loading) {
      const token = getToken();
      if (token && !socket.connected) {
        socket.auth = { token };
        socket.connect();
      }
    }
  }, [loading, user]);

  useEffect(() => {
    socket.on('connect',      () => setMyId(socket.id));
    socket.on('game_state',   s  => setState(s));
    socket.on('chat_message', m  => setChatMsgs(prev => [...prev, m]));
    socket.on('highscores',   hs => setHighscores(hs));
    socket.on('online_users', u  => setOnlineUsers(u));
    socket.on('room_invite',  inv => setInvite(inv));
    socket.on('invite_declined', ({ byName }) => console.log(`${byName} declined your invite`));
    return () => {
      socket.off('connect');
      socket.off('game_state');
      socket.off('chat_message');
      socket.off('highscores');
      socket.off('online_users');
      socket.off('room_invite');
      socket.off('invite_declined');
    };
  }, []);

  function handleJoined(initialState) {
    setMyId(socket.id);
    setState(initialState);
    setInvite(null);
    socket.emit('get_highscores', {}, res => {
      if (res?.ok) setHighscores(res.scores);
    });
  }

  function leaveRoom() {
    socket.emit('leave_room', {}, () => {
      setState(null);
      setChatMsgs([]);
    });
  }

  function acceptInvite(inv) {
    setInvite(null);
    if (!socket.connected) socket.connect();
    const name = user?.displayName || localStorage.getItem('daketi_name') || 'Player';
    socket.emit('join_room', { roomId: inv.roomId, name }, res => {
      if (res.ok) handleJoined(res.state);
    });
  }

  function declineInvite(inv) {
    socket.emit('decline_invite', { fromSocketId: inv.fromSocketId });
    setInvite(null);
  }

  // ── Loading spinner (verifying stored JWT) ────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-spinner" />
      </div>
    );
  }

  // ── Show auth page when not logged in and not continuing as guest ─────────
  if (!user && !asGuest) {
    return <AuthPage onContinueAsGuest={() => setAsGuest(true)} />;
  }

  // ── Invite toast (shown on any screen after auth) ─────────────────────────
  const inviteToast = invite && (
    <div className="invite-toast">
      <div className="invite-toast-inner">
        <span className="invite-toast-icon">🃏</span>
        <div className="invite-toast-text">
          <strong>{invite.fromName}</strong> invited you to room <strong>{invite.roomId}</strong>
        </div>
        <div className="invite-toast-actions">
          <button className="invite-btn invite-btn--accept" onClick={() => acceptInvite(invite)}>Join</button>
          <button className="invite-btn invite-btn--decline" onClick={() => declineInvite(invite)}>✕</button>
        </div>
      </div>
    </div>
  );

  // ── Profile modal ─────────────────────────────────────────────────────────
  const profileModal = showProfile && user && (
    <ProfileModal onClose={() => setShowProfile(false)} />
  );

  // ── Abandoned game ────────────────────────────────────────────────────────
  if (state?.phase === 'abandoned') {
    return (
      <>
        {inviteToast}
        {profileModal}
        <div className="lobby">
          <div className="lobby-card" style={{ textAlign: 'center', gap: '1.2rem' }}>
            <div style={{ fontSize: '2.5rem' }}>😔</div>
            <h2 style={{ color: 'var(--gold)', fontFamily: 'Cinzel, serif' }}>Opponent Left</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 'var(--fs-sm)' }}>
              The other player disconnected. The game has ended.
            </p>
            <button className="btn-gold" onClick={() => { setState(null); setChatMsgs([]); }}>
              Back to Lobby
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Waiting room ──────────────────────────────────────────────────────────
  if (state?.phase === 'lobby') {
    const isHost = state.hostId === myId;
    const roomPlayerIds = new Set(state.players.map(p => p.id));
    const inviteable = onlineUsers.filter(u => u.socketId !== myId && !roomPlayerIds.has(u.socketId));

    return (
      <>
        {inviteToast}
        {profileModal}
        <div className="lobby">
          <div className="lobby-card">
            <div className="lobby-room-code">{state.roomId}</div>
            <p className="lobby-share">Share this code — or invite friends below</p>

            <ul className="lobby-players">
              {state.players.map(p => (
                <li key={p.id} className={p.id === myId ? 'lp-me' : ''}>
                  <span className="lp-avatar">{p.name[0]?.toUpperCase()}</span>
                  {p.name} {p.id === state.hostId ? '👑' : ''}
                </li>
              ))}
            </ul>

            {inviteable.length > 0 && (
              <div className="wr-online">
                <div className="wr-online-lbl">Online now</div>
                {inviteable.map(u => (
                  <div key={u.socketId} className="wr-online-row">
                    <span className="lp-avatar" style={{ width: 24, height: 24, fontSize: '.65rem' }}>{u.name[0]?.toUpperCase()}</span>
                    <span className="wr-online-name">{u.name}</span>
                    <button className="invite-pill" onClick={() => socket.emit('invite_to_room', { targetSocketId: u.socketId, roomId: state.roomId })}>
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}

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
            <button className="btn-leave" onClick={leaveRoom}>← Leave Room</button>
          </div>
        </div>
      </>
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────
  if (state && state.phase !== 'lobby') {
    return (
      <>
        {inviteToast}
        {profileModal}
        <Game
          state={state} myId={myId}
          chatMessages={chatMsgs} highscores={highscores}
          onLeave={leaveRoom}
          user={user}
          onOpenProfile={() => setShowProfile(true)}
        />
      </>
    );
  }

  // ── Landing lobby ─────────────────────────────────────────────────────────
  return (
    <>
      {inviteToast}
      {profileModal}
      <Lobby
        onJoined={handleJoined}
        onlineUsers={onlineUsers}
        mySocketId={myId}
        user={user}
        onOpenProfile={() => setShowProfile(true)}
      />
    </>
  );
}
