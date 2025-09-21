import api from './apiClient';
export async function createIssue(payload) {
  // payload อย่างน้อยต้องมี { type, title } สำหรับกรณีเรือ: { type:'vessel', vessel_id, title, ... }
  const { data } = await api.post('/issues', payload);
  return data;
}
export async function listIssues(params = {}) {
  const res = await api.get('/issues', { params });
  return res.data;
}
export async function updateIssue(id, data) {
  const res = await api.patch(`/issues/${id}`, data);
  return res.data;
}