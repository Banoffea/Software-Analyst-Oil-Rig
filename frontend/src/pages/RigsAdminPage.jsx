// frontend/src/pages/RigsAdminPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listRigs, createRig, updateRig, deleteRig } from '../api/rigs';
import { useAuth } from '../utils/auth.jsx';

const STATUSES = ['online','offline','maintenance'];

export default function RigsAdminPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listRigs({ q: q || undefined, status: status==='all' ? undefined : status, limit: 500 });
      setRows(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, [q, status]);

  const counts = useMemo(() => {
    const c = { all: rows.length, online:0, offline:0, maintenance:0 };
    for (const r of rows) c[r.status] = (c[r.status]||0)+1;
    return c;
  }, [rows]);

  const visible = rows; // กรองฝั่ง server แล้ว

  const changeStatus = async (row, s) => {
    if (row.status === s) return;
    const prev = row.status;
    setRows(rs => rs.map(x => x.id===row.id ? { ...x, status:s, __saving:true } : x));
    try {
      await updateRig(row.id, { status: s });
      setRows(rs => rs.map(x => x.id===row.id ? { ...x, __saving:false } : x));
    } catch {
      setRows(rs => rs.map(x => x.id===row.id ? { ...x, status:prev, __saving:false } : x));
      alert('Update status failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Rigs</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          {isAdmin && (  /* <-- show only for admin */
            <button
              className="btn btn-primary"
              onClick={()=>{ setEditRow(null); setShowModal(true); }}
            >
              + Add rig
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-2">
            {['all','online','offline','maintenance'].map(t => (
              <button
                key={t}
                className={`btn ${status===t ? 'btn-primary' : 'btn-ghost'}`}
                onClick={()=>setStatus(t)}
              >
                {t[0].toUpperCase()+t.slice(1)} <span className="muted ml-1">({counts[t]||0})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input"
              placeholder="Search by code/name/location"
              style={{minWidth:260}}
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
            <tr>
              <th style={{width:80}}>ID</th>
              <th style={{width:140}}>Rig code</th>
              <th>Name</th>
              <th>Location</th>
              <th style={{width:120}}>Lat</th>
              <th style={{width:120}}>Lon</th>
              <th style={{width:120}}>Capacity</th>
              <th style={{width:160}}>Status</th>
              <th style={{width:200}} className="text-right">Actions</th>
            </tr>
            </thead>
            <tbody>
            {loading && <tr><td colSpan={9} className="muted">Loading…</td></tr>}
            {!loading && !visible.length && <tr><td colSpan={9} className="muted">No rigs</td></tr>}
            {!loading && visible.map(r => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td className="font-mono">{r.rig_code}</td>
                <td>{r.name}</td>
                <td className="muted">{r.location || '-'}</td>
                <td className="muted">{r.lat ?? '-'}</td>
                <td className="muted">{r.lon ?? '-'}</td>
                <td className="muted">{r.capacity ?? '-'}</td>
                <td onClick={e=>e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <select
                      className="select"
                      value={r.status}
                      onChange={e=>changeStatus(r, e.target.value)}
                      disabled={r.__saving}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {r.__saving && <span className="muted text-xs">Saving…</span>}
                  </div>
                </td>
                <td className="text-right">
                  <div className="inline-flex gap-2">
                    <button className="btn btn-ghost" onClick={()=>{ setEditRow(r); setShowModal(true); }}>Edit</button>
                    <button
                      className="btn btn-ghost"
                      onClick={async ()=>{
                        if (!confirm(`Delete rig ${r.rig_code}?`)) return;
                        await deleteRig(r.id);
                        load();
                      }}
                    >Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal &&
        <RigModal
          row={editRow}
          onClose={()=>setShowModal(false)}
          onSaved={()=>{ setShowModal(false); load(); }}
        />
      }
    </div>
  );
}

function RigModal({ row, onClose, onSaved }) {
  const [rig_code, setRigCode] = useState(row?.rig_code || '');
  const [name, setName] = useState(row?.name || '');
  const [location, setLocation] = useState(row?.location || '');
  const [lat, setLat] = useState(row?.lat ?? '');
  const [lon, setLon] = useState(row?.lon ?? '');
  const [capacity, setCapacity] = useState(row?.capacity ?? '');
  const [status, setStatus] = useState(row?.status || 'online');
  const [busy, setBusy] = useState(false);

  async function submit(e){
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { rig_code, name, location, lat, lon, capacity, status };
      if (row) await updateRig(row.id, payload);
      else     await createRig(payload);
      onSaved?.();
    } catch (e) {
      alert(e?.response?.data?.message || 'Save failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e)=>{ if (e.target===e.currentTarget) onClose?.(); }}>
      <div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <h3 className="modal-title">{row ? 'Edit rig' : 'Create rig'}</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <div className="muted text-xs mb-1">Rig code</div>
              <input className="input w-full" value={rig_code} onChange={e=>setRigCode(e.target.value)} required disabled={!!row}/>
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Name</div>
              <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} required />
            </label>
            <label className="block md:col-span-2">
              <div className="muted text-xs mb-1">Location</div>
              <input className="input w-full" value={location} onChange={e=>setLocation(e.target.value)} />
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Lat</div>
              <input className="input w-full" value={lat} onChange={e=>setLat(e.target.value)} />
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Lon</div>
              <input className="input w-full" value={lon} onChange={e=>setLon(e.target.value)} />
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Capacity</div>
              <input className="input w-full" value={capacity} onChange={e=>setCapacity(e.target.value)} />
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Status</div>
              <select className="select w-full" value={status} onChange={e=>setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{row ? 'Adding…' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
