import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,        // สำคัญ: ส่งคุกกี้
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status ?? 'NO_RESPONSE';
    const msg = err.response?.data?.message ?? err.message ?? 'Network error';
    console.error('[API ERROR]', status, msg);
    return Promise.reject(err);
  }
);

export default api;
