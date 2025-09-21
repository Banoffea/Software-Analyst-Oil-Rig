// src/pages/IssuesList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listIssues, updateIssue } from '../api/issues';
import IssueModal from '../components/IssueModal';
import { useAuth } from '../utils/auth.jsx'; // ⬅️ เพิ่ม

const POLL_MS = 30000;

// หมายเหตุ: ถ้าระบบคุณเปลี่ยนชุดสถานะแล้ว ให้ปรับรายการนี้ตามจริงได้เลย
// ตัวอย่างนี้คงค่าเดิมไว้ แต่รองรับ 'approved' ด้วย (UI จะ disable ให้)
const STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'approved']; // ⬅️ เติม 'approved'

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
  // รองรับสถานะเดิม + เพิ่ม waiting_approval / need_rework / approved
  const map = {
    open:'#10b981',
    in_progress:'#f59e0b',
    waiting_approval:'#a855f7',
    need_rework:'#ef4444',
    resolved:'#3b82f6',
    approved:'#3b82f6',
    closed:'#6b7280'
  };
  return (
    <span className="muted" style={{display:'inline-flex',alignItems:'center'}}>
      <Dot color={map[v] || '#64748b'} />{(v || '-').replace('_',' ')}
    </span>
  );
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
  const { me } = useAuth();                    // ⬅️ เอา role ของผู้ใช้มาใช้เช็คสิทธิ์
  const canApprove = me?.role === 'manager' || me?.role === 'admin';   // ⬅️ อนุญาต approve เฉพาะ manager

  const [typeTab, setTypeTab] = useState('all');      // all | oil | lot | vessel | shipment
  const [status, setStatus] = useState('all');        // all | <statuses>
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allRows, setAllRows] = useState([]);         // เก็บทั้งหมด
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

  // นับจำนวนตาม type
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

  // กรองสำหรับแสดง
  const visible = useMemo(() => {
    let rows = allRows;
    if (typeTab !== 'all') rows = rows.filter(r => r.type === typeTab);
    if (status !== 'all') rows = rows.filter(r => r.status === status);
    return rows;
  }, [allRows, typeTab, status]);

  // เปลี่ยนสถานะ
  const changeStatus = async (row, newStatus) => {
    // 1) ห้ามใครแก้ออกมาจาก approved (ล็อกตาย)
    if (row.status === 'approved' && newStatus !== 'approved') {
      alert('This issue is already approved and cannot be changed.');
      return;
    }
    // 2) เฉพาะ manager เท่านั้นที่ตั้งเป็น approved ได้
    if (newStatus === 'approved' && !canApprove) {
      alert('Only managers can set status to "approved".');
      return;
    }

    if (row.status === newStatus) return;

    const prev = row.status;
    setAllRows(rs => rs.map(it => it.id === row.id ? ({ ...it, status: newStatus, __saving: true }) : it));
    try {
      await updateIssue(row.id, { status: newStatus });
      setAllRows(rs => rs.map(it => it.id === row.id ? ({ ...it, __saving: false }) : it));
    } catch (e) {
      setAllRows(rs => rs.map(it => it.id === row.id ? ({ ...it, status: prev, __saving: false }) : it));
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
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="approved">Approved</option> {/* เผื่อหลังบ้านใช้สถานะนี้ */}
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
                <th style={{width:170}}>Actions</th>
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
                      <select
                        className="select"
                        style={{minWidth:160}}
                        value={r.status}
                        onChange={(e)=>changeStatus(r, e.target.value)}
                        // ล็อกไม่ให้เปลี่ยนสถานะอีกเมื่อ approved แล้ว (ใครก็แก้ไม่ได้)
                        disabled={r.__saving || r.status === 'approved'}
                      >
                        {STATUSES.map(s => (
                          <option
                            key={s}
                            value={s}
                            // ถ้าไม่ใช่ manager ให้กด approved ไม่ได้ (แสดงให้เห็นแต่ disabled)
                            disabled={s === 'approved' && !canApprove}
                          >
                            {s.replace('_',' ')}
                          </option>
                        ))}
                      </select>
                      {r.__saving && <span className="muted text-xs">Saving…</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewRow && <IssueDetailModal row={viewRow} onClose={() => setViewRow(null)} />}
      <IssueModal open={reportOpen} onClose={()=>setReportOpen(false)} />
    </div>
  );
}

function IssueDetailModal({ row, onClose }) {
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

        <div className="flex justify-end mt-4">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
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
