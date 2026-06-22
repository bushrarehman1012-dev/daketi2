import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage({ onContinueAsGuest }) {
  const { register, login } = useAuth();
  const [tab,      setTab]  = useState('login');   // 'login' | 'register'
  const [form,     setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [err,      setErr]  = useState('');
  const [busy,     setBusy] = useState(false);

  function field(key) {
    return {
      value: form[key],
      onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
    };
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (tab === 'login') {
        await login({ username: form.username, password: form.password });
      } else {
        await register({
          username:    form.username,
          displayName: form.displayName || form.username,
          email:       form.email,
          password:    form.password,
        });
      }
      // AuthContext sets user → App renders Lobby
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-root">
      <div className="lobby-bg-suits" aria-hidden>
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>

      <div className="auth-content">
        {/* Logo */}
        <div className="lobby-hero-wrap">
          <img src="/card-back-hero.jpg" className="lobby-hero-card" alt="Daketi" />
        </div>
        <div className="lobby-brand">
          <h1 className="lobby-wordmark">DAKETI</h1>
          <p className="lobby-tagline">The Art of the Steal</p>
        </div>

        <div className="auth-card">
          {/* Tabs */}
          <div className="lf-tabs">
            <button className={`lf-tab ${tab === 'login'    ? 'lf-tab--active' : ''}`} onClick={() => { setTab('login');    setErr(''); }}>Log In</button>
            <button className={`lf-tab ${tab === 'register' ? 'lf-tab--active' : ''}`} onClick={() => { setTab('register'); setErr(''); }}>Sign Up</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {tab === 'register' && (
              <div className="lf-field">
                <label className="lf-label">Display Name</label>
                <input className="lf-input" placeholder="What others see…" maxLength={20} {...field('displayName')} />
              </div>
            )}

            <div className="lf-field">
              <label className="lf-label">Username</label>
              <input className="lf-input" placeholder="Username…" maxLength={20} autoComplete="username" required {...field('username')} />
            </div>

            {tab === 'register' && (
              <div className="lf-field">
                <label className="lf-label">Email <span className="auth-optional">(optional)</span></label>
                <input className="lf-input" type="email" placeholder="email@example.com" {...field('email')} />
              </div>
            )}

            <div className="lf-field">
              <label className="lf-label">Password</label>
              <input className="lf-input" type="password" placeholder="Password…" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required {...field('password')} />
            </div>

            {err && <p className="lf-error">⚠ {err}</p>}

            <button className="lf-btn lf-btn--primary" type="submit" disabled={busy}>
              {busy ? '…' : tab === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button className="lf-btn lf-btn--secondary" onClick={onContinueAsGuest}>
            Continue as Guest
          </button>

          <p className="lf-rules-hint">Guest sessions are temporary — log in to save history & friends</p>
        </div>
      </div>
    </div>
  );
}
