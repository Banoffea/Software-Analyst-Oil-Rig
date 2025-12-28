// src/utils/auth.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/apiClient';

/* ========= safe localStorage helpers ========= */
function readUserCache() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  if (raw === 'undefined' || raw === 'null' || raw.trim() === '') {
    localStorage.removeItem('user');
    return null;
  }
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}
function writeUserCache(user) {
  if (!user) {
    localStorage.removeItem('user');
    return;
  }
  try { localStorage.setItem('user', JSON.stringify(user)); } catch {}
}

/* ========= services ========= */
export const login = async (username, password) => {
  const { data } = await api.post('/auth/login', { username, password });
  const user = data?.user ?? null;
  writeUserCache(user);
  return user;
};

export const fetchMe = async () => {
  try {
    const { data } = await api.get('/auth/me');
    const user = data?.user ?? null;
    writeUserCache(user);
    return user;
  } catch {
    writeUserCache(null);
    return null;
  }
};

export const logout = async () => {
  try { await api.post('/auth/logout'); } catch {}
  writeUserCache(null);
  // ไม่บังคับ redirect ที่นี่ ให้ context เป็นคนเคลียร์ me
};

/* ========= React Auth Context ========= */
const AuthCtx = createContext({
  me: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }) {
  // preload จาก cache ให้ UI เร็วขึ้น แล้วค่อย sync กับ /auth/me
  const [me, setMe] = useState(() => readUserCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await fetchMe();
      if (!alive) return;
      setMe(user);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const loginCtx = async (username, password) => {
    const user = await login(username, password);
    setMe(user);
    return user;
  };

  const refresh = async () => {
    const user = await fetchMe();
    setMe(user);
    return user;
  };

  // ✅ เคลียร์ me ใน context ด้วย เพื่อให้ UI เด้งออกจากระบบทันที
  const logoutCtx = async (opts = { redirect: false }) => {
    try { await logout(); } finally {
      setMe(null);
      if (opts.redirect) {
        // ถ้าต้องการนำทางไปหน้า /login ทันที
        try {
          window.history.pushState({}, '', '/login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch {
          window.location.href = '/login';
        }
      }
    }
  };

  const value = useMemo(
    () => ({ me, setMe, loading, login: loginCtx, logout: logoutCtx, refresh }),
    [me, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
