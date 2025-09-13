import React, { useState } from 'react';
import { login } from '../api/auth';

export default function Login({ onLogin }) {
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [err,setErr] = useState('');

  const submit = async (e) => {
  e.preventDefault();
  try {
    const data = await login(username, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/dashboard'; // redirect หลัง login
  } catch (err) {
    setErr(err.response?.data?.message || 'Login failed');
  }
};


  return (
    <div className="login-page">
      <h2>Oil Ops Login</h2>
      <form onSubmit={submit}>
        <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button>Login</button>
      </form>
      {err && <div className="error">{err}</div>}
    </div>
  );
}
