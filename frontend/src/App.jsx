import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const token = localStorage.getItem('token');
  const [user, setUser] = useState(token ? JSON.parse(localStorage.getItem('user')) : null);

  return user ? <Dashboard user={user} setUser={setUser} /> : <Login onLogin={(token,user)=>{ localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user); }} />
}
