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

const STATUS_FILTERS = [
  'in_progress',
  'need_rework',
  'awaiting_fleet_approval',
  'awaiting_manager_approval',
  'approved',
];

export default function IssuesList() {
  const { me } = useAuth();
  const role = me?.role;

  const [typeTab, setTypeTab] = useState('all');          // all | oil | lot | vessel | shipment
  const [severity, setSeverity] = useState('all');        // ⬅️ new
  const [status, setStatus]   = useState('all');          // all | <statuses>
  const [q, setQ]             = useState('');
  const [from, setFrom]       = useState(''); // YYYY-MM-DD
  const [to, setTo]           = useState(''); // YYYY-MM-DD
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [workRow, setWorkRow] = useState(null);

  // Refs + helper for in-field calendar icon
  const fromRef = useRef(null);
  const toRef   = useRef(null);

  const openPicker = (ref) => {
    const el = ref?.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };

  // role-based visibility
  const allowedTypes = useMemo(() => {
    if (role === 'production') return ['oil','lot'];
    if (role === 'captain' || role === 'fleet') return ['vessel','shipment'];
    return ['oil','lot','vessel','shipment']; // manager/admin
  }, [role]);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
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

  const counts = useMemo(() => {
    const filtered = (allRows || []).filter(r => allowedTypes.includes(r.type));
    const c = { all: filtered.length, oil: 0, lot: 0, vessel: 0, shipment: 0 };
    for (const r of filtered) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [allRows, allowedTypes]);

  // counts for severities (respect allowedTypes and current typeTab)
  const sevCounts = useMemo(() => {
    const base = (allRows || []).filter(
      r => allowedTypes.includes(r.type) && (typeTab === 'all' || r.type === typeTab)
    );
    const c = { all: base.length, low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of base) {
      const sv = (r.severity || '').toLowerCase();
      if (sv in c) c[sv] += 1;
    }
    return c;
  }, [allRows, allowedTypes, typeTab]);

  // counts for statuses (respect allowedTypes and current typeTab)
  const statusCounts = useMemo(() => {
    const base = (allRows || []).filter(
      r => allowedTypes.includes(r.type) && (typeTab === 'all' || r.type === typeTab)
    );
    const c = { all: base.length };
    for (const s of STATUS_FILTERS) c[s] = 0;
    for (const r of base) {
      const st = r.status;
      if (st && st in c) c[st] += 1;
    }
    return c;
  }, [allRows, allowedTypes, typeTab]);

  // rows shown in table (role + user filters)
  const visible = useMemo(() => {
    let rows = (allRows || []).filter(r => allowedTypes.includes(r.type));
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    if (severity !== 'all') rows = rows.filter(r => r.severity === severity);
    if (status !== 'all') rows = rows.filter(r => r.status === status);
    if (q.trim()) {
      const terms = q.trim().toLowerCase().split(/\s+/);
      rows = rows.filter(r => {
        const hs = buildSearchHaystack(r);
        return terms.every(t => hs.includes(t));
      });
    }
    return rows;
  }, [allRows, allowedTypes, typeTab, severity, status, q]);

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

  // สร้างรายการตัวเลือกสำหรับ Type ตาม role
  const TABS = useMemo(() => {
    // ถ้า role นั้นเห็นได้มากกว่า 1 ประเภท ให้มีตัวเลือก "all" ด้วย
    if ((allowedTypes || []).length > 1) return ['all', ...allowedTypes];
    // ถ้าเห็นได้ประเภทเดียว ไม่ต้องมี "all"
    return [...allowedTypes];
  }, [allowedTypes]);

  useEffect(() => {
    if (!TABS.includes(typeTab)) {
      setTypeTab(TABS[0]); // ถ้ามี 'all' ก็เป็น all ถ้าไม่มีก็เป็นประเภทเดียวที่อนุญาต
    }
  }, [TABS, typeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Reports</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div className="card-head flex items-center gap-2 flex-wrap px-3 py-3">
          {/* ย่อ Search ให้แคบลง */}
          <input
            className="input"
            placeholder="Search by title / context"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: 500 }}
          />

          {/* ย่อ Type */}
          <select
            className="select"
            value={typeTab}
            onChange={(e) => setTypeTab(e.target.value)}
            
            style={{ width: 250 }}
          >
            <option value="all">All type ({counts.all ?? 0})</option>
            {TABS.filter(t => t !== 'all').map(t => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)} ({counts[t] ?? 0})
              </option>
            ))}
          </select>

          {/* ✅ Severity filter with counts */}
          <select
            className="select"
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            style={{ width: 170 }}
          >
            <option value="all">All severity ({sevCounts.all ?? 0})</option>
            {SEVERITY_FILTERS.map(s => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)} ({sevCounts[s] ?? 0})
              </option>
            ))}
          </select>

          {/* Status filter with counts */}
          <select
            className="select"
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ width: 250 }}
          >
            <option value="all">All status ({statusCounts.all ?? 0})</option>
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>
                {s.replaceAll('_',' ')} ({statusCounts[s] ?? 0})
              </option>
            ))}
          </select>

          {/* From with in-field calendar icon (scoped CSS) */}
          <div className="dt2">
            <input
              ref={fromRef}
              type="datetime-local"
              className="input dt2-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button
              type="button"
              className="dt2-icon"
              onClick={() => openPicker(fromRef)}
              aria-label="Pick from date & time"
              title="Pick date & time"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18" height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor" strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
          </div>

          <span className="muted">to</span>

          {/* To with in-field calendar icon (scoped CSS) */}
          <div className="dt2">
            <input
              ref={toRef}
              type="datetime-local"
              className="input dt2-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button
              type="button"
              className="dt2-icon"
              onClick={() => openPicker(toRef)}
              aria-label="Pick to date & time"
              title="Pick date & time"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18" height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor" strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
          </div>
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

      {/* ===== Scoped styles for in-field calendar icon ===== */}
      <style>{CSS_DT2}</style>
    </div>
  );
}

/* Scoped CSS */
const CSS_DT2 = `
/* wrapper ของช่อง datetime-local */
.dt2 {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* เพิ่มช่องว่างขวาให้พอสำหรับไอคอน */
.dt2-input {
  padding-right: 44px !important;
  min-width: 200px;
}

/* ปุ่มไอคอนอยู่ "ข้างใน" ช่อง */
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
}

.dt2-icon:hover {
  color: var(--brand, #138AEC);
}

/* ซ่อน calendar indicator ของ browser เพื่อใช้ไอคอนเราแทน */
.dt2-input::-webkit-calendar-picker-indicator {
  opacity: 0;
}

/* ป้องกันไอคอนโดนบังในบาง browser ที่มี padding/outline แปลก ๆ */
.dt2-input::-ms-clear { display: none; }
`;
