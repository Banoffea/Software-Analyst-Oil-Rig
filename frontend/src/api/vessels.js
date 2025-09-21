// frontend/src/api/vessels.js
import api from './apiClient';

export async function listVessels() {
  const { data } = await api.get('/vessels');
  return data; // [{id, vessel_no, name, capacity, status}, ...]
}

export async function listLatestPositions() {
  const { data } = await api.get('/vessels/positions/latest');
  // [{vessel_id, recorded_at, lat, lon, speed, course}, ...]
  return data;
}

export async function createVessel(payload) {
  // payload: { vessel_no?, name?, capacity?, status? }
  const { data } = await api.post('/vessels', payload);
  return data; // { id: newId }
}
