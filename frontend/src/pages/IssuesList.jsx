// src/pages/IssuesList.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listIssues, getIssue, deleteIssue } from '../api/issues';
import { useAuth } from '../utils/auth.jsx';
import IssueWorkModal from '../components/IssueWorkModal';

const POLL_MS = 30000;

function fmt(ts) {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19);
}

function Dot({ color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        verticalAlign: 'baseline',
      }}
    />
  );
}

function SeverityBadge({ v }) {
  const map = { low:'#7c3aed', medium:'#2563eb', high:'#dc2626', critical:'#b91c1c' };
  return (
    <span className="muted" style={{display:'inline-flex',alignItems:'center'}}>
      <Dot color={map[v] || '#64748b'} />{v || '-'}
    </span>
  );
}

function StatusBadge({ v }) {
  const map = {
    open:'#3b82f6',
    in_progress:'#f59e0b',
    waiting_approval:'#a855f7',
    need_rework:'#ef4444',
    approved:'#10b981',
    awaiting_manager_approval:'#2563eb',
    awaiting_fleet_approval:'#14b8a6',
  };
  return (
    <span className="muted" style={{display:'inline-flex',alignItems:'center'}}>
      <Dot color={map[v] || '#64748b'} />{(v || '-').replaceAll('_',' ')}
    </span>
  );
}

function contextText(row) {
  if (row.type === 'oil') {
    const rig = row.rig_id ? `Rig #${row.rig_id}` : 'Rig -';
    const reading = `Reading #${row.reading_id || '-'}`;
    return `${rig} • ${reading}`;
  }
  if (row.type === 'lot') {
    const rig = row.rig_id ? `Rig #${row.rig_id}` : 'Rig -';
    const lot = row.lot_id ? `Lot #${row.lot_id}` : 'Lot -';
    return `${rig} • ${lot}`;
  }
  if (row.type === 'vessel') {
    const v = row.vessel_id ? `Vessel #${row.vessel_id}` : 'Vessel -';
    const pos = `Pos #${row.vessel_position_id || '-'}`;
    return `${v} • ${pos}`;
  }
  if (row.type === 'shipment') {
    const v = row.vessel_id ? `Vessel #${row.vessel_id}` : 'Vessel -';
    const voy = row.shipment_id ? `Voyage #${row.shipment_id}` : 'Voyage -';
    return `${v} • ${voy}`;
  }
  return '-';
}

// ใช้ในตาราง/ฟิลเตอร์
const STATUS_FILTERS = [
  'in_progress',
  'need_rework',
  'awaiting_fleet_approval',
  'awaiting_manager_approval',
  'approved',
];

// role → สถานะที่เลือกได้ใน dropdown
const ROLE_STATUS = {
  production: ['in_progress', 'need_rework', 'approved'],
  captain:    ['in_progress', 'awaiting_fleet_approval', 'approved', 'need_rework'],
  fleet:      ['in_progress', 'awaiting_fleet_approval', 'approved', 'need_rework'],
  // manager/admin → fallback เป็น STATUS_FILTERS
};

export default function IssuesList() {
  const { me } = useAuth();
  const role = me?.role;

  const [typeTab, setTypeTab] = useState('all');
  const [status, setStatus]   = useState('all');
  const [q, setQ]             = useState('');
  const [from, setFrom]       = useState(''); // YYYY-MM-DD
  const [to, setTo]           = useState(''); // YYYY-MM-DD
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [workRow, setWorkRow] = useState(null);

  // ===== Refs & handlers for in-field calendar icons =====
  const fromRef = useRef(null);
  const toRef   = useRef(null);
  const openFromPicker = () => {
    const el = fromRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };
  const openToPicker = () => {
    const el = toRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };
  // =======================================================

  // role-based visibility
  const allowedTypes = useMemo(() => {
    if (role === 'production') return ['oil','lot'];
    if (role === 'captain' || role === 'fleet') return ['vessel','shipment'];
    return ['oil','lot','vessel','shipment']; // manager/admin
  }, [role]);

  // ตัวเลือก Type จากสิทธิ์ของ role
  const TYPE_OPTIONS = useMemo(() => ['all', ...allowedTypes], [allowedTypes]);

  // ตัวเลือก Status จาก role (+ 'all')
  const STATUS_OPTIONS = useMemo(() => {
    const base = ROLE_STATUS[role] ?? STATUS_FILTERS;
    return ['all', ...base];
  }, [role]);

  const load = async () => {
    setLoading(true);
    const params = {};
    // ไม่ส่ง q: ค้นหาใน frontend (title + context)
    if (from) params.from = `${from} 00:00:00`;
    if (to)   params.to   = `${to} 23:59:59`;
    try {
      const data = await listIssues(params);
      setAllRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // นับจำนวน per-type (เฉพาะประเภทที่ role เห็น)
  const counts = useMemo(() => {
    const filtered = (allRows || []).filter(r => allowedTypes.includes(r.type));
    const c = { all: filtered.length, oil: 0, lot: 0, vessel: 0, shipment: 0 };
    for (const r of filtered) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [allRows, allowedTypes]);

  // นับจำนวน per-status สำหรับ dropdown (อิง allowedTypes และ type ที่เลือกอยู่)
  const statusCounts = useMemo(() => {
    let rows = (allRows || []).filter(r => allowedTypes.includes(r.type));
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    const c = { all: rows.length };
    for (const s of STATUS_FILTERS) c[s] = 0;
    for (const r of rows) {
      if (r.status) c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [allRows, allowedTypes, typeTab]);

  // คำนวณรายการที่เห็นในตาราง
  const visible = useMemo(() => {
    let rows = (allRows || []).filter(r => allowedTypes.includes(r.type));
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    if (status !== 'all') rows = rows.filter(r => r.status === status);

    if (q.trim()) {
      const k = q.trim().toLowerCase();
      rows = rows.filter(r => {
        const title = (r.title || '').toLowerCase();
        const ctx = contextText(r).toLowerCase();
        return title.includes(k) || ctx.includes(k);
      });
    }
    return rows;
  }, [allRows, allowedTypes, typeTab, status, q]);

  // กันเคสค่าที่เลือกไว้ไม่อยู่ในตัวเลือก (เช่น role เปลี่ยน)
  useEffect(() => {
    if (!TYPE_OPTIONS.includes(typeTab)) setTypeTab('all');
  }, [TYPE_OPTIONS, typeTab]);

  useEffect(() => {
    if (!STATUS_OPTIONS.includes(status)) setStatus('all');
  }, [STATUS_OPTIONS, status]);

  const openWork = async (row) => {
    try {
      const fresh = await getIssue(row.id);
      setWorkRow(fresh);
    } catch {
      alert('Failed to open report');
    }
  };

  const handleDelete = async (row) => {
    if (row.status === 'approved') return;
    if (!window.confirm(`Delete report #${row.id}?`)) return;
    try {
      await deleteIssue(row.id);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Delete failed';
      alert(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Reports</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          {/* ===== Toolbar (Search left | Filters right) ===== */}
          <div className="toolbar">
            <div className="search-wrap">
              <label className="label-muted">Search</label>
              <input
                className="input"
                placeholder="Search by title / context"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>

            <div className="filters">
              <div className="field">
                <label className="label-muted">Type</label>
                <select
                  className="select"
                  value={typeTab}
                  onChange={(e) => setTypeTab(e.target.value)}
                >
                  {TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase()+t.slice(1)} ({counts[t] ?? 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label-muted">Status</label>
                <select
                  className="select"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>
                      {s === 'all'
                        ? `All status (${statusCounts.all ?? 0})`
                        : `${s.replaceAll('_',' ')} (${statusCounts[s] ?? 0})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label-muted">From</label>
                <div className="dt2">
                  <input
                    ref={fromRef}
                    type="date"
                    className="select dt2-input"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <button
                    type="button"
                    className="dt2-icon"
                    onClick={openFromPicker}
                    aria-label="Pick start date"
                    title="Pick start date"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="label-muted">To</label>
                <div className="dt2">
                  <input
                    ref={toRef}
                    type="date"
                    className="select dt2-input"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                  <button
                    type="button"
                    className="dt2-icon"
                    onClick={openToPicker}
                    aria-label="Pick end date"
                    title="Pick end date"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* ================================================== */}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{width:70}}>ID</th>
                <th style={{width:90}}>Type</th>
                <th>Context</th>
                <th>Title</th>
                <th style={{width:180}}>Reported by</th>
                <th style={{width:130}}>Severity</th>
                <th style={{width:200}}>Status</th>
                <th style={{width:170}}>Occurred</th>
                <th style={{width:170}}>Created</th>
                <th style={{width:200}} className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="muted">Loading…</td></tr>}
              {!loading && !visible.length && <tr><td colSpan={10} className="muted">No issues found</td></tr>}
              {!loading && visible.map(r => {
                const canDelete = r.status !== 'approved';
                return (
                  <tr key={r.id} className="hoverable">
                    <td>#{r.id}</td>
                    <td className="capitalize">{r.type}</td>
                    <td className="muted">{contextText(r)}</td>
                    <td>{r.title}</td>
                    <td>{r.reported_by_name || (r.reported_by ? `User #${r.reported_by}` : '-')}</td>
                    <td><SeverityBadge v={r.severity} /></td>
                    <td><StatusBadge v={r.status} /></td>
                    <td className="muted">{fmt(r.anchor_time)}</td>
                    <td className="muted">{fmt(r.created_at)}</td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button className="btn btn-primary" onClick={() => openWork(r)}>Open</button>
                        {canDelete && (
                          <button className="btn btn-ghost" onClick={() => handleDelete(r)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Work modal */}
      {workRow && (
        <IssueWorkModal
          row={workRow}
          role={role}
          onChanged={() => load()}
          onClose={() => setWorkRow(null)}
        />
      )}

      {/* Scoped styles: toolbar layout + calendar hover */}
      <style>{CSS_TOOLBAR}</style>
      <style>{CSS_DT2}</style>
    </div>
  );
}

const CSS_TOOLBAR = `
/* กระจาย 5 บล็อกแบบไม่ยืด */
.toolbar{
  display:flex;
  width:100%;
  justify-content: space-between;  /* ซ้าย/ขวาชนขอบ */
  align-items:end;
  flex-wrap:wrap;
  column-gap:24px;                 /* เว้นคอลัมน์ตอนพับบรรทัด */
  row-gap:12px;
}

/* ดึง 4 fields ใน .filters ขึ้นมาเป็นลูกของ .toolbar */
.filters{ display: contents; }

/* 🔒 ล็อกให้ทั้ง 5 บล็อกกว้างเท่ากัน (ไม่ยืด) */
.search-wrap{
  flex: 0 0 450px;   /* เดิม 240px → เพิ่มเป็น 360px */
  max-width: 360px;
}
.field{
  flex: 0 0 240px;
  max-width: 240px;
}

.search-wrap .input{ width:100%; }
.field .select{ width:100%; }

.label-muted{
  display:block;
  font-size:12px;
  color: var(--muted, #92B0C9);
  margin-bottom:6px;
}

/* เมื่อแคบลง: เลิก space-between เพื่อไม่ให้แถวสุดท้ายเว้นกว้างเกินไป */
@media (max-width: 1280px){
  .toolbar{
    justify-content:flex-start;    /* ใช้ gap ตามปกติ */
  }
}
@media (max-width: 720px){
  .search-wrap, .field{
    flex: 1 1 100%;                /* แถวเดียว เต็มบล็อก */
    max-width: 100%;
  }
}
`;



/* Calendar icon styles (เหมือน OilDashboard) */
const CSS_DT2 = `
.dt2 {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
}
.dt2-input {
  padding-right: 44px !important;
  width: 100%;
}
.dt2-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  color: var(--muted, #92B0C9);
  transition: color .15s ease, transform .15s ease;
}
.dt2-icon:hover {
  color: var(--brand, #138AEC);
  transform: translateY(-50%) scale(1.05);
}
/* ซ่อน indicator เดิมของ browser */
.dt2-input::-webkit-calendar-picker-indicator { opacity: 0; }
.dt2-input::-ms-clear { display: none; }
`;

