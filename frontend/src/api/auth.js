// // src/api/auth.js
// import api from './apiClient';

// // login → server จะตั้งคุกกี้ให้เอง
// export const login = async (username, password) => {
//   const { data } = await api.post('/auth/login', { username, password });
//   localStorage.setItem('user', JSON.stringify(data.user)); // cache เฉพาะ user
//   return data.user; // <-- คืน "user" ตรง ๆ
// };

// // อ่าน session จากคุกกี้
// export const fetchMe = async () => {
//   try {
//     const { data } = await api.get('/auth/me');
//     localStorage.setItem('user', JSON.stringify(data.user));
//     return data.user; // <-- คืน "user" ตรง ๆ
//   } catch {
//     localStorage.removeItem('user');
//     return null;
//   }
// };

// export const logout = async () => {
//   await api.post('/auth/logout');
//   localStorage.removeItem('user');
//   window.location.href = '/login';
// };

// export const getUser = () => {
//   const raw = localStorage.getItem('user');
//   return raw ? JSON.parse(raw) : null;
// };
// src/api/auth.js

import api from './apiClient';

export async function fetchMe() {
  try {
    const { data } = await api.get('/auth/me'); // ต้องมี endpoint นี้ฝั่ง backend
    // แนะนำให้ backend คืน { user: {...} } ถ้า login อยู่
    return data?.user ?? null;
  } catch (e) {
    // อย่าโยน error ขึ้นไป ให้คืน null เพื่อตัด "Loading…" ได้
    return null;
  }
}

export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password });
  return data?.user ?? null;
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
}
