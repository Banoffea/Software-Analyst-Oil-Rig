import axios from 'axios';
import { logout } from '../utils/auth.js'; // path ต้องถูกต้อง

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// เพิ่ม response interceptor ตรวจสอบ 401
client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      logout(); // ถ้า token หมดอายุ หรือไม่ถูกต้อง
    }
    return Promise.reject(err);
  }
);

export default client;
