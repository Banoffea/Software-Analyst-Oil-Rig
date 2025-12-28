// frontend/src/api/adminUsers.js
import api from './apiClient';

export const listUsers  = (params)   => api.get('/admin/users', { params }).then(r => r.data);
export const createUser = (data)     => api.post('/admin/users', data).then(r => r.data);
export const updateUser = (id,data)  => api.patch(`/admin/users/${id}`, data).then(r => r.data);
export const deleteUser = (id)       => api.delete(`/admin/users/${id}`).then(r => r.data);
