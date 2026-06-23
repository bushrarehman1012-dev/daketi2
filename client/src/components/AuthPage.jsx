import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { DaketiLogo } from './DaketiLogo.jsx';

export default function AuthPage({ onContinueAsGuest }) {
  const { register, login } = useAuth();
  const [tab,    setTab]  = useState('login');
  const [form,   setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [err,    setErr]  = useState('');
  const [busy,   setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="lobby-bg-suits" aria-hidden>
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>

      <div className="auth-shell">
        {/* ── Brand / Logo ── */}
        <div className="brand">
          <div className="logo-frame">
            <DaketiLogo className="brand-logo" />
          </div>
          <h1 className="lobby-wordmark">DAKETI</h1>
          <p className="lobby-tagline">The Art of the Steal</p>
        </div>

        {/* ── Auth card ── */}
        <div className="auth-card">
          <div className="lf-tabs">
            <button className={`lf-tab ${tab === 'login'    ? 'lf-tab--active' : ''}`} onClick={() => { setTab('login');    setErr(''); }}>Log In</button>
            <button className={`lf-tab ${tab === 'register' ? 'lf-tab--active' : ''}`} onClick={() => { setTab('register'); setErr(''); }}>Sign Up</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {tab === 'register' && (
              <div className="lf-field">
                <label className="lf-label">Display Name</label>
                <div className="lf-input-wrap">
                  <span className="lf-input-icon lf-iw--user" aria-hidden />
                  <input className="lf-input lf-input--icon" placeholder="What others see…" maxLength={20} {...field('displayName')} />
                </div>
              </div>
            )}

            <div className="lf-field">
              <label className="lf-label">Username</label>
              <div className="lf-input-wrap">
                <span className="lf-input-icon lf-iw--user" aria-hidden />
                <input className="lf-input lf-input--icon" placeholder="Username…" maxLength={20} autoComplete="username" required {...field('username')} />
              </div>
            </div>

            {tab === 'register' && (
              <div className="lf-field">
                <label className="lf-label">Email <span className="auth-optional">(optional)</span></label>
                <div className="lf-input-wrap">
                  <span className="lf-input-icon lf-iw--mail" aria-hidden />
                  <input className="lf-input lf-input--icon" type="email" placeholder="email@example.com" {...field('email')} />
                </div>
              </div>
            )}

            <div className="lf-field">
              <label className="lf-label">Password</label>
              <div className="lf-input-wrap">
                <span className="lf-input-icon lf-iw--lock" aria-hidden />
                <input
                  className="lf-input lf-input--icon lf-input--pw"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password…"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  required
                  {...field('password')}
                />
                <button type="button" className="lf-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                  <span className={`lf-iw--eye${showPw ? '-off' : ''}`} aria-hidden />
                </button>
              </div>
            </div>

            {err && <p className="lf-error">⚠ {err}</p>}

            <button className="lf-btn lf-btn--primary" type="submit" disabled={busy}>
              {busy
                ? <span className="auth-spinner" />
                : <><span className="btn-icon lf-iw--lock-w" aria-hidden /> {tab === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</>
              }
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button className="lf-btn lf-btn--secondary" onClick={onContinueAsGuest}>
            <span className="btn-icon lf-iw--user-w" aria-hidden /> CONTINUE AS GUEST
          </button>

          <p className="lf-rules-hint">Guest sessions are temporary — log in to save history &amp; friends.</p>
        </div>
      </div>
    </div>
  );
}
