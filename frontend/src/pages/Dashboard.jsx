// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';  // <-- เพิ่ม React
import { getSummaryToday, getLatestPerRig } from '../api/readings';


export default function Dashboard() {
  const [summary, setSummary] = useState([]);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, l] = await Promise.all([getSummaryToday(), getLatestPerRig()]);
      setSummary(s);
      setLatest(l);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // poll ทุก 5 วิ
    return () => clearInterval(t);
  }, []);

  const latestByRig = Object.fromEntries(latest.map(r => [r.rig_id, r]));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Production Dashboard (Today)</h1>

      {loading && <div className="text-gray-500">Loading…</div>}

      {/* สรุปผลผลิตรวมต่อแท่น */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="text-lg font-medium mb-3">Total Output by Rig (Today)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left bg-gray-50">
              <tr>
                <th className="p-2">Rig</th>
                <th className="p-2">Total Qty</th>
                <th className="p-2">Avg H2S</th>
                <th className="p-2">Avg CO₂</th>
                <th className="p-2">Avg Temp</th>
                <th className="p-2">Last Reading</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(row => {
                const last = latestByRig[row.rig_id];
                return (
                  <tr key={row.rig_id} className="border-t">
                    <td className="p-2 font-medium">Rig #{row.rig_id}</td>
                    <td className="p-2">{Number(row.total_qty || 0).toLocaleString()}</td>
                    <td className="p-2">{row.avg_h2s?.toFixed?.(3) ?? '-'}</td>
                    <td className="p-2">{row.avg_co2?.toFixed?.(3) ?? '-'}</td>
                    <td className="p-2">{row.avg_temp?.toFixed?.(2) ?? '-'}</td>
                    <td className="p-2 text-xs text-gray-600">{last?.recorded_at?.replace('T',' ').slice(0,19) || '-'}</td>
                  </tr>
                );
              })}
              {!summary.length && (
                <tr><td className="p-2 text-gray-500" colSpan={6}>No data today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* การ์ด realtime ต่อแท่น */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {latest.map(r => (
          <div key={r.rig_id} className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm text-gray-500">Rig #{r.rig_id}</div>
            <div className="text-xs text-gray-400 mb-2">{r.recorded_at?.replace('T',' ').slice(0,19)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Qty" value={r.Quantity} unit="bbl" />
              <Metric label="Temp" value={r.Temperature} unit="°C" />
              <Metric label="Pressure" value={r.Pressure} unit="bar" />
              <Metric label="H₂S" value={r.H2S} unit="ppm" />
              <Metric label="CO₂" value={r.CO2} unit="%vol" />
              <Metric label="Water" value={r.Water} unit="%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, unit }) {
  const v = value == null ? '-' : Number(value).toLocaleString();
  return (
    <div className="border rounded-xl p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold">{v} {v !== '-' ? unit : ''}</div>
    </div>
  );
}
