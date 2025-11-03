// src/pages/IssuesList.jsx
import React, { useEffect, useMemo, useState } from 'react';
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

  const [typeTab, setTypeTab] = useState('all');
  const [status, setStatus]   = useState('all');
  const [q, setQ]             = useState('');
  const [from, setFrom]       = useState(''); // YYYY-MM-DD
  const [to, setTo]           = useState(''); // YYYY-MM-DD
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [workRow, setWorkRow] = useState(null);

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
  }, [q, from, to]);

  const counts = useMemo(() => {
    const filtered = (allRows || []).filter(r => allowedTypes.includes(r.type));
    const c = { all: filtered.length, oil: 0, lot: 0, vessel: 0, shipment: 0 };
    for (const r of filtered) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [allRows, allowedTypes]);

  const visible = useMemo(() => {
    let rows = (allRows || []).filter(r => allowedTypes.includes(r.type));
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    if (status !== 'all') rows = rows.filter(r => r.status === status);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.title||'').toLowerCase().includes(k) ||
        (r.description||'').toLowerCase().includes(k)
      );
    }
    return rows;
  }, [allRows, allowedTypes, typeTab, status, q]);

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

  const TABS = ['all','oil','lot','vessel','shipment'];

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
            placeholder="Search title/description"
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
            {TABS.map(t => (
              <option key={t} value={t}>
                {t[0].toUpperCase()+t.slice(1)} ({counts[t] ?? 0})
              </option>
            ))}
          </select>

          {/* ย่อ Status */}
          <select
            className="select"
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ width: 250 }}
          >
            <option value="all">All status</option>
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>{s.replaceAll('_',' ')}</option>
            ))}
          </select>

          {/* ย่อช่องวันที่ From/To */}
          <input
            type="date"
            className="select"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: 300 }}
          />
          <span className="muted">to</span>
          <input
            type="date"
            className="select"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: 300 }}
          />
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
    </div>
  );
}
