import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';

export default function Chat({ messages, myId, open, onToggle }) {
  const [text, setText]   = useState('');
  const [tts,  setTts]    = useState(false);
  const bottomRef         = useRef(null);
  const prevLenRef        = useRef(0);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // TTS: speak new messages from others
  useEffect(() => {
    if (!tts || messages.length === 0) return;
    const newMsgs = messages.slice(prevLenRef.current);
    prevLenRef.current = messages.length;
    for (const m of newMsgs) {
      if (m.playerId === myId) continue;
      const u = new SpeechSynthesisUtterance(`${m.name} says: ${m.text}`);
      u.rate = 1.1;
      window.speechSynthesis.speak(u);
    }
  }, [messages, tts, myId]);

  function send() {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat_message', { text: t });
    setText('');
  }

  return (
    <div className={`chat-panel ${open ? 'chat-panel--open' : ''}`}>
      <div className="chat-header" onClick={onToggle}>
        <span>💬 Chat</span>
        <div className="chat-header-btns">
          <button
            className={`tts-btn ${tts ? 'tts-btn--on' : ''}`}
            onClick={e => { e.stopPropagation(); setTts(v => !v); }}
            title={tts ? 'Mute audio' : 'Enable audio read-aloud'}
          >
            {tts ? '🔊' : '🔇'}
          </button>
          <span className="chat-chevron">{open ? '▼' : '▲'}</span>
        </div>
      </div>

      {open && (
        <>
          <div className="chat-messages">
            {messages.length === 0 && <p className="chat-empty">No messages yet…</p>}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.playerId === myId ? 'chat-msg--me' : ''}`}>
                <span className="chat-name">{m.name}</span>
                <span className="chat-text">{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              value={text}
              maxLength={200}
              placeholder="Say something…"
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button className="chat-send" onClick={send}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
