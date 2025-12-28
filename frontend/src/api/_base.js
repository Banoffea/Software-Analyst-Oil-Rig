// frontend/src/api/_base.js
import axios from 'axios';

// base URL มาจาก .env ของ Vite: VITE_API_BASE=http://localhost:8000/api
const API_BASE = import.meta.env.VITE_API_BASE;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // สำคัญ: ส่ง cookie-based auth ไปด้วย
  headers: { 'Content-Type': 'application/json' },
});

// (ทางเลือก) ดัก 401 แล้วพาไปหน้าล็อกอิน
// api.interceptors.response.use(
//   (res) => res,
//   (err) => {
//     if (err?.response?.status === 401) {
//       window.location.href = '/login';
//     }
//     return Promise.reject(err);
//   }
// );
