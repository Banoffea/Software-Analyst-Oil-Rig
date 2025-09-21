// src/api/lots.js
import api from './apiClient';

// เรียกเวอร์ชัน query string เป็นหลัก และ fallback ไป path /lots/rig/:rigId ถ้า server มี
export const listLotsByRig = async (rigId, params = {}) => {
  const { data } = await api.get(`/lots/rig/${rigId}`, { params });
  return data;
};

// ถ้า backend ไม่มี /lots/:id/stats ให้ลองเป็น /lots/stats?lot_id=
export const getLotStats = async (lotId) => {
  try {
    const { data } = await api.get(`/lots/${lotId}/stats`);
    return data;
  } catch {
    const { data } = await api.get('/lots/stats', { params: { lot_id: lotId } });
    return data;
  }
};
