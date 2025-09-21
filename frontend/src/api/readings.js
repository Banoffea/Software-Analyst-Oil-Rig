// src/api/readings.js
import api from './apiClient';

export const getSummaryToday = async () =>
  (await api.get('/readings/summary/today')).data;

export const getLatestPerRig = async () =>
  (await api.get('/readings/latest')).data;

export const getHistory = async (params) =>
  (await api.get('/readings/history', { params })).data;

export const getDailySeries = (a, b) => {
  let rig_id, date;

  if (typeof a === 'object' && a !== null) {
    rig_id = a.rig_id ?? a.rigId;
    date   = a.date;
  } else {
    rig_id = a;
    date   = b;
  }

  return api
    .get('/readings/daily', { params: { rig_id, date } })
    .then(r => r.data);
};

export const getLastOfRig = async (rigId) => {
  const { data } = await api.get('/readings/last', { params: { rig_id: rigId } });
  return data;
};
