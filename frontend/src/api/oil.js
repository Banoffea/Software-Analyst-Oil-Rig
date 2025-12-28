import client from './apiClient';
export const getDaily = (date) => client.get(`/oil/daily/${date || ''}`).then(r => r.data);
export const createComponent = (payload) => client.post('/oil', payload).then(r => r.data);
