// src/api/shipments.js
import api from './apiClient';

export const createShipment = async (payload) => {
  const { data } = await api.post('/shipments', payload);
  return data; // { shipment_id }
};

export const addShipmentItems = async (shipmentId, items /* [{lot_id, quantity}] */) => {
  const { data } = await api.post(`/shipments/${shipmentId}/items`, items);
  return data;
};

export const departShipment = async (shipmentId) => {
  const { data } = await api.post(`/shipments/${shipmentId}/depart`);
  return data;
};

export const arriveShipment = async (shipmentId) => {
  const { data } = await api.post(`/shipments/${shipmentId}/arrive`);
  return data;
};

export const listShipments = (params) =>
  api.get('/shipments', { params }).then(r => r.data);
