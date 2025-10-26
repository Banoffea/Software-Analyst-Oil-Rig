// frontend/src/pages/RigsAdminPage.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { listRigs, createRig, updateRig, deleteRig } from '../api/rigs';
import { useAuth } from '../utils/auth.jsx';

const STATUSES = ['online','offline','maintenance'];

export default function RigsAdminPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const isProduction = me?.role === 'production';
  const canChangeStatus = isProduction;

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

  const visible = rows; // server filtered already

  const changeStatus = async (row, s) => {
  if (!canChangeStatus) return;
  if (row.status === s) return;

  // แสดงกำลังบันทึก แต่ *ไม่* เปลี่ยนค่า status ล่วงหน้า
  setRows(rs => rs.map(x => x.id===row.id ? { ...x, __saving:true } : x));

  try {
    await updateRig(row.id, { status: s });
    // ✅ ดึงข้อมูลจาก server มาคอนเฟิร์ม (กันค่า local เพี้ยน)
    await load();
  } catch (e) {
    const msg = e?.response?.data?.message || 'Update status failed';
    alert(msg);
    // ยกเลิกสถานะ saving
    setRows(rs => rs.map(x => x.id===row.id ? { ...x, __saving:false } : x));
  }
};


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Rigs</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          {isAdmin && (
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
                <th style={{width:200}}>Status</th>
                {isAdmin && <th style={{width:200}} className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={isAdmin?9:8} className="muted">Loading…</td></tr>}
              {!loading && !visible.length && <tr><td colSpan={isAdmin?9:8} className="muted">No rigs</td></tr>}
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
                    <StatusCell
                      value={r.status}
                      saving={r.__saving}
                      canEdit={canChangeStatus}
                      onChange={(s)=>changeStatus(r, s)}
                    />
                  </td>
                  {isAdmin && (
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
                  )}
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

      {/* local styles for status dot */}
      <style>{`
        .status-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#0b1220; border:1px solid #334155; cursor:default; }
        .status-pill.editable { cursor:pointer; }
        .dot { width:10px; height:10px; border-radius:999px; }
        .dot.online { background:#10b981; }
        .dot.offline { background:#ef4444; }
        .dot.maintenance { background:#f59e0b; }
        .status-menu { position:absolute; z-index:40; background:#0b1220; border:1px solid #334155; border-radius:10px; padding:6px; box-shadow:0 12px 30px rgba(0,0,0,.35); }
        .status-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer; }
        .status-item:hover { background:#111827; }
      `}</style>
    </div>
  );
}

function StatusCell({ value, saving, canEdit, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null); // <-- เปลี่ยนเป็น wrapper ref

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      // ถ้าคลิกอยู่นอก wrapper (ที่ครอบ pill + menu) ค่อยปิด
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    // จะใช้ 'click' หรือ 'mousedown' ก็ได้ แต่ 'click' ปลอดภัยกว่าในเคสนี้
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const pill = (
    <div
      className={`status-pill ${canEdit ? 'editable' : ''}`}
      onClick={() => canEdit && !saving && setOpen(v => !v)}
      title={canEdit ? (saving ? 'Saving…' : 'Click to change') : ''}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : -1}
      aria-haspopup={canEdit ? 'menu' : undefined}
      aria-expanded={canEdit ? open : undefined}
      onKeyDown={(e)=>{ if (canEdit && (e.key==='Enter'||e.key===' ')) setOpen(v=>!v); }}
    >
      <span className={`dot ${value}`} />
      <span style={{ textTransform:'capitalize' }}>{value}</span>
      {canEdit && <span className={`caret ${open ? 'up' : ''}`} aria-hidden="true">▾</span>}
      {saving && <span className="muted text-xs" style={{marginLeft:6}}>Saving…</span>}
    </div>
  );

  if (!canEdit) return pill;

  return (
    // ⬅️ ย้าย ref มาใส่ wrapper ที่ครอบทั้ง pill + menu
    <div ref={wrapRef} style={{ position:'relative', display:'inline-block' }}>
      {pill}
      {open && !saving && (
        <div className="status-menu" style={{ top:'110%', left:0 }}>
          {['online','offline','maintenance'].map(s => (
            <div
              key={s}
              className="status-item"
              role="menuitem"
              onClick={() => { setOpen(false); if (s!==value) onChange?.(s); }}
            >
              <span className={`dot ${s}`} />
              <span style={{ textTransform:'capitalize' }}>{s}</span>
            </div>
          ))}
        </div>
      )}
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
              <input className="input w-full" value={rig_code} onChange={e=>setRigCode(e.target.value)} required disabled={!!row} onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")} onInput={e => e.target.setCustomValidity("")}/>
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Name</div>
              <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} required onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")} onInput={e => e.target.setCustomValidity("")}/>
            </label>
            <label className="block md:col-span-2">
              <div className="muted text-xs mb-1">Location</div>
              <input className="input w-full" value={location} onChange={e=>setLocation(e.target.value)} required onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")} onInput={e => e.target.setCustomValidity("")}/>
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Lat</div>
              <input className="input w-full" value={lat} onChange={e=>setLat(e.target.value)} required onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")} onInput={e => e.target.setCustomValidity("")}/>
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Lon</div>
              <input className="input w-full" value={lon} onChange={e=>setLon(e.target.value)} required onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")} onInput={e => e.target.setCustomValidity("")}/>
            </label>
            <label className="block">
              <div className="muted text-xs mb-1">Capacity</div>
              <input className="input w-full" value={capacity} onChange={e=>setCapacity(e.target.value)} required onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")} onInput={e => e.target.setCustomValidity("")}/>
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
            <button className="btn btn-primary" disabled={busy}>{row ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
