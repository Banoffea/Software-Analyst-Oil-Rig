import React, { useEffect, useMemo, useState } from 'react';
import { listVessels, listLatestPositions, createVessel } from '../api/vessels';
import { createIssue } from '../api/issues';

const POLL_MS = 10000;

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '-';
  return Number(n).toFixed(d);
}
function fmtDeg(n) {
  if (n === null || n === undefined) return '-';
  return `${Number(n).toFixed(0)}°`;
}
function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd} • ${hh}:${mm}`;
}

/** กันข้อมูลซ้ำแม้ backend จะส่งมาผิดพลาด */
function dedupeById(arr) {
  const map = new Map();
  for (const x of arr || []) map.set(Number(x.id), x);
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

export default function VesselDashboard() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // all | sailing | idle | loading
  const [q, setQ]             = useState('');

  async function load() {
    setLoading(true);
    try {
      const [vessels, latest] = await Promise.all([
        listVessels(),
        listLatestPositions(),
      ]);

      const posMap = new Map();
      (latest || []).forEach(p => posMap.set(Number(p.vessel_id), p));

      const merged = dedupeById(vessels || []).map(v => {
        const p = posMap.get(Number(v.id)) || null;
        return {
          ...v,
          last: p
            ? {
                recorded_at: p.recorded_at,
                lat: p.lat != null ? Number(p.lat) : null,
                lon: p.lon != null ? Number(p.lon) : null,
                speed: p.speed != null ? Number(p.speed) : null,
                course: p.course != null ? Number(p.course) : null,
              }
            : null,
        };
      });

      setRows(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => ({
    all: rows.length,
    sailing: rows.filter(r => r.status === 'sailing').length,
    idle: rows.filter(r => r.status === 'idle').length,
    loading: rows.filter(r => r.status === 'loading').length,
  }), [rows]);

  const shown = useMemo(() => {
    let list = rows;
    if (filter !== 'all') list = list.filter(r => r.status === filter);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      list = list.filter(r =>
        String(r.name || '').toLowerCase().includes(k) ||
        String(r.vessel_no || '').toLowerCase().includes(k)
      );
    }
    return list;
  }, [rows, filter, q]);

  async function onAddVessel() {
    const name = window.prompt('Vessel name:');
    if (name === null) return;
    const vessel_no = window.prompt('Vessel No (optional):') || null;
    const capacity  = window.prompt('Capacity (optional, number):');
    try {
      await createVessel({
        name,
        vessel_no,
        capacity: capacity ? Number(capacity) : null,
        status: 'idle',
      });
      await load();
      alert('Vessel added.');
    } catch (e) {
      console.error(e);
      alert('Add vessel failed');
    }
  }

  async function onReport(v) {
    const title = window.prompt(`Report issue for ${v.name || v.vessel_no || '#'+v.id}\nTitle:`);
    if (!title) return;
    const description = window.prompt('Description (optional):') || '';
    try {
      await createIssue({
        type: 'vessel',
        vessel_id: v.id,
        severity: 'medium',
        title,
        description,
      });
      alert('Issue reported. Thank you!');
    } catch (e) {
      console.error(e);
      alert('Report failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Vessels</h2>
        <div className="flex gap-2">
          <button className="btn" onClick={onAddVessel}>Add vessel</button>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button className={`btn ${filter==='all'?'btn-primary':''}`} onClick={() => setFilter('all')}>
          All({counts.all})
        </button>
        <button className={`btn ${filter==='sailing'?'btn-primary':''}`} onClick={() => setFilter('sailing')}>
          Sailing({counts.sailing})
        </button>
        <button className={`btn ${filter==='idle'?'btn-primary':''}`} onClick={() => setFilter('idle')}>
          Idle({counts.idle})
        </button>
        <button className={`btn ${filter==='loading'?'btn-primary':''}`} onClick={() => setFilter('loading')}>
          Loading({counts.loading})
        </button>

        <input
          className="input ml-auto"
          style={{minWidth: 320}}
          placeholder="Search by name / vessel no / IMO"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th style={{width:70, textAlign:'left'}}>#</th>
              <th style={{textAlign:'left'}}>Name</th>
              <th style={{textAlign:'left'}}>Vessel No</th>
              <th style={{textAlign:'left'}}>Status</th>
              <th style={{textAlign:'left'}}>Speed</th>
              <th style={{textAlign:'left'}}>Course</th>
              <th style={{textAlign:'left'}}>Last position</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="p-3 text-gray-500">Loading...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={8} className="p-3 text-gray-500">No data</td></tr>}

            {!loading && shown.map(v => {
              const showDetail = v.status !== 'idle'; // ตามที่ขอ: idle ไม่ต้องแสดงรายละเอียด
              const p = v.last;

              return (
                <tr key={v.id}>
                  <td className="py-2">#{v.id}</td>
                  <td>{v.name || '-'}</td>
                  <td>{v.vessel_no || '-'}</td>
                  <td>
                    <span className="pill">{v.status || '-'}</span>
                  </td>
                  <td>{showDetail && p ? `${fmt(p.speed)} kn` : '-'}</td>
                  <td>{showDetail && p ? fmtDeg(p.course) : '-'}</td>
                  <td>
                    {showDetail && p
                      ? `${fmt(p.lat,5)}, ${fmt(p.lon,5)} • ${fmtTime(p.recorded_at)}`
                      : '-'}
                  </td>
                  <td>
                    <button className="btn btn-primary" onClick={() => onReport(v)}>
                      Report issue
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        * รายละเอียดตำแหน่งจะแสดงเฉพาะเรือที่ไม่อยู่ในสถานะ <b>idle</b>.
      </p>
    </div>
  );
}
