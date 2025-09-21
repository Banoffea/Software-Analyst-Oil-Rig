// src/pages/Login.jsx
import React, { useState, useRef, useEffect } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await onLogin(username, password); // ให้ App จัดการ state ต่อ
      // สำเร็จแล้ว react-router ใน App จะส่งไป "/" เอง
    } catch (error) {
      setErr(error?.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login-page p-6 max-w-sm mx-auto">
      <h2 className="text-xl font-semibold mb-4">Oil Ops Login</h2>
      <form onSubmit={submit} className="space-y-3">
        <input
          ref={userRef}
          className="border p-2 w-full"
          placeholder="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-3 py-2 rounded w-full">Login</button>
      </form>
      {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
    </div>
  );
}
