// src/pages/IssuesList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listIssues, updateIssue } from '../api/issues';
import IssueModal from '../components/IssueModal';
import { useAuth } from '../utils/auth.jsx';

const POLL_MS = 30000;

// dropdown (row) shows ONLY these three
const BASIC_STATUSES = ['open', 'in_progress', 'waiting_approval'];

// used for badges/filters (unchanged behavior)
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

/** Context formatter — แสดง reading/pos เสมอ (ถ้าไม่มีจะแสดง '-') */
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

  // who can change the three basic statuses via dropdown?
  const canChangeBasicStatus = (row) => {
    if (!role) return false;
    if (role === 'admin' || role === 'manager') return true; // full control
    if ((row.type === 'oil' || row.type === 'lot') && role === 'production') return true;
    if ((row.type === 'vessel' || row.type === 'shipment') && (role === 'fleet' || role === 'captain')) return true;
    return false;
  };

  // who can approve / request rework (special buttons in the popup)?
  const canModerate = role === 'admin' || role === 'manager';

  const [typeTab, setTypeTab] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reportOpen, setReportOpen] = useState(false);
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

  // counters
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

  // visible rows
  const visible = useMemo(() => {
    let rows = allRows;
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    if (status !== 'all') rows = rows.filter(r => r.status === status);
    return rows;
  }, [allRows, typeTab, status]);

  // change status (basic three from dropdown)
  const changeStatus = async (row, newStatus) => {
    if (row.status === 'approved') return;          // locked
    if (!canChangeBasicStatus(row)) return;         // not allowed
    if (!BASIC_STATUSES.includes(newStatus)) return; // safety
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
        <h1 className="page-title">Issues</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={() => setReportOpen(true)}>Report an issue</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-2">
            {TABS.map(t => (
              <button
                key={t}
                className={`btn ${typeTab===t ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTypeTab(t)}
              >
                {t[0].toUpperCase()+t.slice(1)} <span className="muted ml-2">({counts[t] ?? 0})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              className="input"
              placeholder="Search title/description"
              value={q}
              onChange={e=>setQ(e.target.value)}
              style={{minWidth:220}}
            />
            <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="all">All status</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
            <input type="datetime-local" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
            <span className="muted">to</span>
            <input type="datetime-local" className="input" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
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

                  {/* prevent opening modal when using the dropdown */}
                  <td onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {r.status === 'approved' ? (
                      // ✅ ถ้า approved ให้แสดงป้ายสีเขียวแทน dropdown
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
                      // ปกติยังเป็น dropdown สถานะพื้นฐาน 3 ค่า
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
      <IssueModal open={reportOpen} onClose={()=>setReportOpen(false)} />
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

        {/* Footer: Close on left, actions on right */}
        <div className="flex justify-between mt-4">
          <button className="btn" onClick={onClose}>Close</button>

          {canModerate && row.status !== 'approved' && (
            <div className="flex gap-2">
              <button
                className="btn"
                onClick={() => setStatus('need_rework')}
                disabled={busy}
                title="Request changes before approval"
                style={{ background:'#ef4444', borderColor:'#ef4444', color:'#fff' }} // red
              >
                Request rework
              </button>
              <button
                className="btn"
                onClick={() => setStatus('approved')}
                disabled={busy}
                style={{ background:'#10b981', borderColor:'#10b981', color:'#fff' }} // green
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
