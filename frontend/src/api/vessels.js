import client from './apiClient';
export const getVessels = () => client.get('/vessels').then(r => r.data);
export const getVessel = (id) => client.get(`/vessels/${id}`).then(r => r.data);
export const updateVessel = (id, payload) => client.put(`/vessels/${id}`, payload).then(r => r.data);
