// frontend/src/api/rigs.js
import api from './apiClient';

export const listRigs   = (params)           => api.get('/rigs', { params }).then(r => r.data);
export const createRig  = (data)             => api.post('/rigs', data).then(r => r.data);
export const updateRig  = (id, data)         => api.patch(`/rigs/${id}`, data).then(r => r.data);
export const deleteRig  = (id)               => api.delete(`/rigs/${id}`).then(r => r.data);
