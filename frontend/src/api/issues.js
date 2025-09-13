import client from './apiClient';
export const listIssues = (query = {}) => client.get('/issues', { params: query }).then(r => r.data);
export const createIssue = (payload) => client.post('/issues', payload).then(r => r.data);
export const updateIssueStatus = (id, status) => client.put(`/issues/${id}/status`, { status }).then(r => r.data);
