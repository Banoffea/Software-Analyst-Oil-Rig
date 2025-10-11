// src/pages/Login.jsx
import React, { useState, useRef, useEffect } from 'react';
import logo from '../assets/company_logo.png';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const userRef = useRef(null);

  useEffect(() => { userRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await onLogin(username, password);
    } catch (error) {
      setErr(error?.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login-shell">
      {/* Top bar */}
      <header className="site-header">
        <div className="container" >
          <img
            src={logo}
            alt="Logo"
            width='auto'
            height="43"
          />
          <div className="brand">OffshoreManagingDashboards</div>
        </div>
      </header>

      {/* Centered card */}
      <main className="login-main">
        <div className="login-card card">
          <div className="login-head">
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-sub">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={submit} className="login-form">
            {/* Username */}
            <label className="field">
              <div className="input-icon">
                <span className="icon-left" aria-hidden="true">
                  {/* user icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" fill="currentColor"/>
                  </svg>
                </span>
                <input
                  ref={userRef}
                  className="input pl-40" /* see CSS note about pl-40 */
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </label>

            {/* Password */}
            <label className="field">
              <div className="input-icon">
                <span className="icon-left" aria-hidden="true">
                  {/* lock icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M17 10h-1V8a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2H10V8Z" fill="currentColor"/>
                  </svg>
                </span>
                <input
                  className="input pl-40"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </label>

            <button type="submit" className="btn btn-primary btn-lg w-full">
              Login
            </button>
          </form>

          {err && <div className="login-error text-sm">{err}</div>}
        </div>
      </main>
    </div>
  );
}
