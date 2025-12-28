// src/components/LotDetailModal.jsx
import React, { useEffect, useState } from 'react';
import RealtimeDailyChart from './RealtimeDailyChart';
import { getDailySeries } from '../api/readings';

function avg(arr) {
  let s = 0, c = 0;
  for (const v of arr || []) {
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) { s += n; c++; }
  }
  return c ? s / c : null;
}

// เลือกคีย์แบบยืดหยุ่น (รองรับทั้ง qty/quantity, temp/temperature)
const pickArr = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v) && v.length) return v;
  }
  return obj?.[keys[0]] ?? []; // อย่างน้อยคืน array ว่าง
};

export default function LotDetailModal({ lot, rigId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [series, setSeries]   = useState(null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!lot || !lot.lot_date || !rigId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getDailySeries(rigId, lot.lot_date);
        if (!alive) return;
        setSeries(data);
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.message || e.message || 'Load failed');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [lot?.lot_date, rigId]);

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose?.(); };
  if (!lot) return null;

  // ทำให้เป็นออปเจ็กต์เสมอ กัน error "target must be an object"
  const S = (series && series.series) ? series.series : {};

  const summary = {
    qty:       avg(pickArr(S, 'qty', 'quantity')),
    temp:      avg(pickArr(S, 'temp', 'temperature')),
    pressure:  avg(pickArr(S, 'pressure')),
    humidity:  avg(pickArr(S, 'humidity')),
    h2s:       avg(pickArr(S, 'h2s')),
    co2:       avg(pickArr(S, 'co2')),
    water:     avg(pickArr(S, 'water')),
  };

  const fmt = (v, d=2) => Number.isFinite(v) ? v.toFixed(d) : '–';

  return (
    <div className="modal-backdrop" onMouseDown={onBackdrop}>
      <div className="modal" onMouseDown={(e)=>e.stopPropagation()}>
        <h3 className="modal-title">Lot #{lot.id} — {lot.lot_date}</h3>

        <div className="space-y-4">
          <div className="muted text-sm">
            Rig #{rigId} • Status: {lot.status} • Total qty: {Number(lot.total_qty || 0).toLocaleString()}
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Daily averages</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Qty (bbl)</th>
                    <th>Temp (°C)</th>
                    <th>Pressure (bar)</th>
                    <th>Humidity (%)</th>
                    <th>H₂S (ppm)</th>
                    <th>CO₂ (%vol)</th>
                    <th>Water (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{fmt(summary.qty, 0)}</td>
                    <td>{fmt(summary.temp, 1)}</td>
                    <td>{fmt(summary.pressure, 2)}</td>
                    <td>{fmt(summary.humidity, 1)}</td>
                    <td>{fmt(summary.h2s, 2)}</td>
                    <td>{fmt(summary.co2, 2)}</td>
                    <td>{fmt(summary.water, 2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {loading && <div className="muted p-2">Loading…</div>}
            {error && <div className="text-red-600 p-2">Error: {String(error)}</div>}
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Daily chart</div></div>
            <RealtimeDailyChart rigId={rigId} date={lot.lot_date} height={320} />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
