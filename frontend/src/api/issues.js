import api from './apiClient'; // ← keep consistent with the rest of your app

// CRUD
export async function createIssue(payload) {
  const { data } = await api.post('/issues', payload);
  return data;
}

export async function listIssues(params = {}) {
  const { data } = await api.get('/issues', { params });
  return data;
}

export async function getIssue(id) {
  const { data } = await api.get(`/issues/${id}`);
  return data;
}

export async function updateIssue(id, payload) {
  const { data } = await api.patch(`/issues/${id}`, payload);
  return data;
}

export async function deleteIssue(id) {
  const { data } = await api.delete(`/issues/${id}`);
  return data;
}

// Work/submit flow
export async function submitIssueReport(id, body) {
  // If caller passes a FormData already, send as-is.
  if (body instanceof FormData) {
    const { data } = await api.post(`/issues/${id}/submit`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  // Otherwise build FormData from a plain object { finish_time, action_report, files }
  const fd = new FormData();

  // Normalize finish_time:
  // - if "YYYY-MM-DDTHH:mm" → convert to "YYYY-MM-DD HH:mm:00"
  // - if already "YYYY-MM-DD HH:mm[:ss]" keep it
  let ft = body?.finish_time;
  if (ft) {
    if (typeof ft === 'string' && ft.includes('T')) {
      ft = ft.replace('T', ' ') + (ft.length === 16 ? ':00' : '');
    }
    fd.append('finish_time', ft);
  }

  if (body?.action_report) fd.append('action_report', body.action_report);
  (body?.files || []).forEach((f) => fd.append('photos', f));

  const { data } = await api.post(`/issues/${id}/submit`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function approveIssue(id) {
  const { data } = await api.post(`/issues/${id}/approve`);
  return data;
}

export async function rejectIssue(id) {
  const { data } = await api.post(`/issues/${id}/reject`);
  return data;
}
