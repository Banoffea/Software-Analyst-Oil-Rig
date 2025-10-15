// src/pages/IssuesList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listIssues, updateIssue } from '../api/issues';
import { useAuth } from '../utils/auth.jsx';

const POLL_MS = 30000;
const BASIC_STATUSES = ['open', 'in_progress', 'waiting_approval'];
const ALL_STATUSES = ['open','in_progress','waiting_approval','need_rework','approved'];

function fmt(ts) {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19);
}

function Dot({ color }) {
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:color,marginRight:6,verticalAlign:'baseline'}} />;
}

function SeverityBadge({ v }) {
  const map = { low:'#7c3aed', medium:'#2563eb', high:'#dc2626', critical:'#b91c1c' };
  return <span className="muted" style={{display:'inline-flex',alignItems:'center'}}><Dot color={map[v] || '#64748b'} />{v || '-'}</span>;
}

function StatusBadge({ v }) {
  const map = {
    open:'#3b82f6',
    in_progress:'#f59e0b',
    waiting_approval:'#a855f7',
    need_rework:'#ef4444',
    approved:'#10b981',
  };
  return <span className="muted" style={{display:'inline-flex',alignItems:'center'}}><Dot color={map[v] || '#64748b'} />{(v || '-').replace('_',' ')}</span>;
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

export default function IssuesList() {
  const { me } = useAuth();
  const role = me?.role;

  const canChangeBasicStatus = (row) => {
    if (!role) return false;
    if (role === 'admin' || role === 'manager') return true;
    if ((row.type === 'oil' || row.type === 'lot') && role === 'production') return true;
    if ((row.type === 'vessel' || row.type === 'shipment') && (role === 'fleet' || role === 'captain')) return true;
    return false;
  };

  const canModerate = role === 'admin' || role === 'manager';

  const [typeTab, setTypeTab] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewRow, setViewRow] = useState(null);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (from) params.from = from.replace('T',' ') + ':00';
    if (to)   params.to   = to.replace('T',' ') + ':00';
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
    const c = { all: allRows.length, oil: 0, lot: 0, vessel: 0, shipment: 0 };
    for (const r of allRows) {
      if (r.type === 'oil') c.oil++;
      else if (r.type === 'lot') c.lot++;
      else if (r.type === 'vessel') c.vessel++;
      else if (r.type === 'shipment') c.shipment++;
    }
    return c;
  }, [allRows]);

  const visible = useMemo(() => {
    let rows = allRows;
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    if (status !== 'all') rows = rows.filter(r => r.status === status);
    return rows;
  }, [allRows, typeTab, status]);

  const changeStatus = async (row, newStatus) => {
    if (row.status === 'approved') return;
    if (!canChangeBasicStatus(row)) return;
    if (!BASIC_STATUSES.includes(newStatus)) return;
    if (row.status === newStatus) return;

    const prev = row.status;
    setAllRows(rs => rs.map(it => it.id === row.id ? { ...it, status: newStatus, __saving: true } : it));
    try {
      await updateIssue(row.id, { status: newStatus });
      setAllRows(rs => rs.map(it => it.id === row.id ? { ...it, __saving: false } : it));
    } catch (e) {
      setAllRows(rs => rs.map(it => it.id === row.id ? { ...it, status: prev, __saving: false } : it));
      alert('Update status failed');
    }
  };

  const TABS = ['all','oil','lot','vessel','shipment'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Reports</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          {/* (Removed) Report an issue button */}
        </div>
      </div>

      <div className="card">
        {/* Toolbar row */}
        <div className="card-head flex items-center gap-2 flex-wrap px-3 py-3">
          <input
            className="input"
            placeholder="Search title/description"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ minWidth: 400, maxWidth: 600 }}
          />

          <select
            className="select"
            value={typeTab}
            onChange={(e) => setTypeTab(e.target.value)}
            style={{ minWidth: 140, maxWidth: 150 }}
          >
            {TABS.map(t => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)} ({counts[t] ?? 0})
              </option>
            ))}
          </select>

          <select
            className="select"
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ minWidth: 150, maxWidth: 170 }}
          >
            <option value="all">All status</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s.replace('_',' ')}</option>
            ))}
          </select>

          <input
            type="datetime-local"
            className="input"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <span className="muted">to</span>
          <input
            type="datetime-local"
            className="input"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{width:70}}>ID</th>
                <th style={{width:90}}>Type</th>
                <th>Context</th>
                <th>Title</th>
                <th style={{width:130}}>Severity</th>
                <th style={{width:140}}>Status</th>
                <th style={{width:170}}>Occurred</th>
                <th style={{width:170}}>Created</th>
                <th style={{width:190}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="muted">Loading…</td></tr>}
              {!loading && !visible.length && <tr><td colSpan={9} className="muted">No issues found</td></tr>}
              {!loading && visible.map(r => (
                <tr
                  key={r.id}
                  className="clickable"
                  onClick={() => setViewRow(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e)=> (e.key === 'Enter' || e.key === ' ') && setViewRow(r)}
                >
                  <td>{r.id}</td>
                  <td className="capitalize">{r.type}</td>
                  <td className="muted">{contextText(r)}</td>
                  <td>{r.title}</td>
                  <td><SeverityBadge v={r.severity} /></td>
                  <td><StatusBadge v={r.status} /></td>
                  <td className="muted">{fmt(r.anchor_time)}</td>
                  <td className="muted">{fmt(r.created_at)}</td>

                  <td onClick={(e)=>e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {r.status === 'approved' ? (
                        <span
                          style={{
                            padding: '6px 10px',
                            borderRadius: 5,
                            color: '#10b981',
                            fontSize: 14
                          }}
                        >
                          approved
                        </span>
                      ) : (
                        <select
                          className="select"
                          style={{minWidth:160}}
                          value={r.status}
                          onChange={(e)=>changeStatus(r, e.target.value)}
                          disabled={r.__saving || !canChangeBasicStatus(r)}
                        >
                          {BASIC_STATUSES.map(s => (
                            <option key={s} value={s}>{s.replace('_',' ')}</option>
                          ))}
                        </select>
                      )}
                      {r.__saving && <span className="muted text-xs">Saving…</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewRow && (
        <IssueDetailModal
          row={viewRow}
          canModerate={canModerate}
          onStatusChange={(id, newStatus) => {
            setAllRows(rs => rs.map(x => x.id === id ? { ...x, status: newStatus } : x));
          }}
          onClose={() => setViewRow(null)}
        />
      )}
      {/* Removed IssueModal since we no longer open it from here */}
    </div>
  );
}

function IssueDetailModal({ row, onClose, canModerate, onStatusChange }) {
  const [busy, setBusy] = useState(false);

  const setStatus = async (newStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      await updateIssue(row.id, { status: newStatus });
      onStatusChange?.(row.id, newStatus);
    } catch (e) {
      alert('Update status failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e)=>{ if (e.target===e.currentTarget) onClose(); }}>
      <div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <h3 className="modal-title">Issue #{row.id}</h3>

        <div className="grid md:grid-cols-2 gap-3">
          <Field k="Type" v={row.type} />
          <Field k="Severity" v={<SeverityBadge v={row.severity} />} />
          <Field k="Status" v={<StatusBadge v={row.status} />} />
          <Field k="Occurred" v={fmt(row.anchor_time)} />
          <Field k="Created" v={fmt(row.created_at)} />
          <Field k="Updated" v={fmt(row.updated_at)} />
          {row.type === 'oil' && (<><Field k="Rig ID" v={row.rig_id || '-'} /><Field k="Reading ID" v={row.reading_id || '-'} /></>)}
          {row.type === 'lot' && (<><Field k="Rig ID" v={row.rig_id || '-'} /><Field k="Lot ID" v={row.lot_id || '-'} /></>)}
          {row.type === 'vessel' && (<><Field k="Vessel ID" v={row.vessel_id || '-'} /><Field k="Vessel Position ID" v={row.vessel_position_id || '-'} /></>)}
          {row.type === 'shipment' && (<><Field k="Vessel ID" v={row.vessel_id || '-'} /><Field k="Voyage (Shipment) ID" v={row.shipment_id || '-'} /></>)}
          <div className="md:col-span-2">
            <div className="muted text-xs mb-1">Title</div>
            <div className="border rounded-xl p-2">{row.title || '-'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="muted text-xs mb-1">Description</div>
            <div className="border rounded-xl p-3 whitespace-pre-wrap" style={{minHeight:80}}>
              {row.description || <span className="muted">-</span>}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <button className="btn" onClick={onClose}>Close</button>

          {canModerate && row.status !== 'approved' && (
            <div className="flex gap-2">
              <button
                className="btn"
                onClick={() => setStatus('need_rework')}
                disabled={busy}
                title="Request changes before approval"
                style={{ background:'#ef4444', borderColor:'#ef4444', color:'#fff'  }}
              >
                Request rework
              </button>
              <button
                className="btn"
                onClick={() => setStatus('approved')}
                disabled={busy}
                style={{ background:'#10b981', borderColor:'#10b981', color:'#fff' }}
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ k, v }) {
  return (
    <div className="border rounded-xl p-2">
      <div className="muted text-xs">{k}</div>
      <div>{v ?? '-'}</div>
    </div>
  );
}
