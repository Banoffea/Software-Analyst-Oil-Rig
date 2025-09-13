import client from './apiClient.js';  // ต้องมี .js

export const login = (username, password) =>
  client.post('/auth/login', { username, password }).then(r => r.data);
