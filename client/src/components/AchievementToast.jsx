import { useState, useCallback, useRef } from 'react';

// Message pools
const POOLS = {
  steal:        ['Daketi! 🎭', 'Smooth criminal!', 'Snatched it! 😈', 'Too easy 😏'],
  steal2:       ['Double Daketi!! 🎊', 'They didn\'t see it coming!', 'Ruthless! 🔥'],
  steal3:       ['TRIPLE STEAL! 🤯', 'Absolutely robbing the place!', 'Someone stop this person! 😂'],
  streak:       ['On a roll! Keep going! ⚡', 'Unstoppable! 🚀', 'They\'re powerless! 😂'],
  stolen_from:  ['Oi! That\'s mine! 😤', 'You\'ll pay for that…', 'Bold move, let\'s see 😬'],
  locked:       ['Set locked! 🔒 Untouchable!', 'No one\'s taking that!', 'Secured! ✅'],
  lock_all:     ['FULL LOCK! 👑 You\'re a legend!', 'Four of a kind — LOCKED IN! 🏆'],
  safe_lock:    ['Stack shielded! 🛡️', 'No one can touch that now', 'All four — you\'re safe here 🟢'],
};

function pick(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

let nextId = 0;

export function useAchievements() {
  const [toasts, setToasts] = useState([]);
  const streakRef = useRef(0);
  const stealCountRef = useRef(0);

  const push = useCallback((text, icon = '🎴', color = '#1a3faa') => {
    const id = ++nextId;
    setToasts(prev => [...prev.slice(-2), { id, text, icon, color }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const onSteal = useCallback(() => {
    stealCountRef.current++;
    streakRef.current++;
    const n = stealCountRef.current;
    if (n >= 3)      push(pick(POOLS.steal3), '💀', '#8b1111');
    else if (n === 2) push(pick(POOLS.steal2), '🎊', '#1a5caa');
    else              push(pick(POOLS.steal),  '😈', '#1a3faa');
    if (streakRef.current >= 3) push(pick(POOLS.streak), '⚡', '#8b6b00');
  }, [push]);

  const onStolenFrom = useCallback(() => {
    stealCountRef.current = 0;
    streakRef.current = 0;
    push(pick(POOLS.stolen_from), '😤', '#6b1111');
  }, [push]);

  const onLock = useCallback((isAll) => {
    push(pick(isAll ? POOLS.lock_all : POOLS.locked), '🔒', '#8b6b00');
  }, [push]);

  const onSafeLock = useCallback(() => {
    push(pick(POOLS.safe_lock), '🛡️', '#1a6b2a');
  }, [push]);

  const onDrop = useCallback(() => {
    stealCountRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    stealCountRef.current = 0;
    streakRef.current = 0;
  }, []);

  return { toasts, onSteal, onStolenFrom, onLock, onSafeLock, onDrop, reset };
}

export function AchievementToast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="ach-container">
      {toasts.map(t => (
        <div key={t.id} className="ach-toast" style={{ '--ach-color': t.color }}>
          <span className="ach-icon">{t.icon}</span>
          <span className="ach-text">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
