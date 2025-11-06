// frontend/src/pages/RigsAdminPage.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { listRigs, createRig, updateRig, deleteRig } from '../api/rigs';
import { useAuth } from '../utils/auth.jsx';

const STATUSES = ['online','offline','maintenance'];

/* ==== Lightweight global toast (bottom-right, success style) ==== */
function showGlobalToast(message, duration = 2500) {
  let container = document.getElementById("itoast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "itoast-container";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    Object.assign(container.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      zIndex: "2147483647",
    });
    document.body.appendChild(container);
  }

  const item = document.createElement("div");
  Object.assign(item.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#16a34a", // green
    color: "#FFFFFF",
    border: "1px solid #16a34a",
    borderRadius: "12px",
    padding: "10px 12px",
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    fontSize: "14px",
    opacity: "0",
    transform: "translateY(6px)",
    transition: "opacity .18s ease, transform .18s ease",
  });

  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="white" fill-opacity="0.95"></circle>
      <path d="M6 10.2l2.2 2.2L14 6.9" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;

  const text = document.createElement("span");
  text.textContent = message;

  item.appendChild(icon);
  item.appendChild(text);
  container.appendChild(item);

  requestAnimationFrame(() => {
    item.style.opacity = "1";
    item.style.transform = "translateY(0)";
  });

  const timeout = setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(6px)";
    item.addEventListener("transitionend", () => {
      try {
        container.removeChild(item);
        if (!container.childElementCount) container.parentNode?.removeChild(container);
      } catch {}
    }, { once: true });
  }, duration);

  return () => clearTimeout(timeout);
}

export default function RigsAdminPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const isProduction = me?.role === 'production';
  const canChangeStatus = isProduction;

  const [rows, setRows] = useState([]);
  const [allRigs, setAllRigs] = useState([]); // ✅ เก็บรายการทั้งหมดไว้ตรวจซ้ำ rig_code
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // ✅ นับแบบ GLOBAL แยกจากรายการที่แสดง
  const [globalCounts, setGlobalCounts] = useState({ all: 0, online: 0, offline: 0, maintenance: 0 });
  const computeStatusCounts = (list=[]) => {
    const c = { all: list.length, online: 0, offline: 0, maintenance: 0 };
    for (const r of list) if (r?.status && Object.prototype.hasOwnProperty.call(c, r.status)) c[r.status]++;
    return c;
  };

  async function load() {
    setLoading(true);
    try {
      const [filtered, all] = await Promise.all([
        listRigs({ q: q || undefined, status: status==='all' ? undefined : status, limit: 500 }),
        listRigs({ limit: 10000 }) // ใช้สำหรับนับจำนวนรวม + ตรวจซ้ำ
      ]);
      setRows(Array.isArray(filtered) ? filtered : []);
      const allList = Array.isArray(all) ? all : [];
      setAllRigs(allList);
      setGlobalCounts(computeStatusCounts(allList));
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, [q, status]);

  const visible = rows;

  const changeStatus = async (row, s) => {
    if (!canChangeStatus) return;
    if (row.status === s) return;

    setRows(rs => rs.map(x => x.id===row.id ? { ...x, __saving:true } : x));
    try {
      await updateRig(row.id, { status: s });
      await load(); // sync จาก server และอัปเดต globalCounts/allRigs
    } catch (e) {
      const msg = e?.response?.data?.message || 'Update status failed';
      alert(msg);
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
            <button className="btn btn-primary" onClick={()=>{ setEditRow(null); setShowModal(true); }}>
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
                {t[0].toUpperCase()+t.slice(1)} <span className="muted ml-1">({globalCounts[t]||0})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input"
              placeholder="Search by code / name / location"
              style={{minWidth:264}}
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
                            await load();
                            // showGlobalToast('Rig deleted.'); // ถ้าต้องการ toast ตอนลบ ค่อยเปิดใช้
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
          existingRigs={allRigs}          // ✅ ส่งรายการทั้งหมดลงไปตรวจซ้ำ
          onClose={()=>setShowModal(false)}
          onSaved={(mode)=>{
            setShowModal(false);
            load();
            showGlobalToast(mode === 'create' ? 'Rig created successfully.' : 'Rig updated successfully.');
          }}
        />
      }

      <style>{`
        .status-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; border:none; cursor:default; }
        .status-pill.editable { cursor:pointer; }
        .status-pill.online { background: rgba(34,197,94,0.15); color:#4ADE80; }
        .status-pill.offline { background: rgba(239,68,68,0.15); color:#F87171; }
        .status-pill.maintenance { background: rgba(245,158,11,0.15); color:#fbbf24; }
        .dot { width:10px; height:10px; border-radius:999px; }
        .dot.online { background:#4ADE80; }
        .dot.offline { background:#F87171; }
        .dot.maintenance { background:#FACC15; }
        .status-menu { background:#0b1220; border:1px solid #334155; border-radius:10px; padding:6px; box-shadow:0 12px 30px rgba(0,0,0,.35); }
        .status-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer; }
        .status-item:hover { background:#111827; }
      `}</style>
    </div>
  );
}

/* ---------- StatusCell: dropdown ลอยด้วย Portal ---------- */
function StatusCell({ value, saving, canEdit, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const anchorRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!anchorRef.current) return;
      const inAnchor = anchorRef.current.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inAnchor && !inMenu) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const recalc = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  };
  useEffect(() => { if (open) recalc(); }, [open]);
  useEffect(() => {
    const h = () => open && recalc();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('scroll', h, true);
      window.removeEventListener('resize', h);
    };
  }, [open]);

  const pill = (
    <div
      ref={anchorRef}
      className={`status-pill ${value} ${canEdit ? 'editable' : ''}`}
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
      {canEdit && <span aria-hidden="true">▾</span>}
      {saving && <span className="muted text-xs" style={{marginLeft:6}}>Saving…</span>}
    </div>
  );

  if (!canEdit) return pill;

  return (
    <>
      {pill}
      {open && !saving && createPortal(
        <div
          ref={menuRef}
          className="status-menu"
          role="menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: Math.max(160, pos.width),
            zIndex: 1000
          }}
        >
          {STATUSES.map(s => (
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
        </div>,
        document.body
      )}
    </>
  );
}

/* ---------- Modal ---------- */
function RigModal({ row, existingRigs = [], onClose, onSaved }) {
  const [rig_code, setRigCode] = useState(row?.rig_code || '');
  const [name, setName] = useState(row?.name || '');
  const [location, setLocation] = useState(row?.location || '');
  const [lat, setLat] = useState(row?.lat ?? '');
  const [lon, setLon] = useState(row?.lon ?? '');
  const [capacity, setCapacity] = useState(row?.capacity ?? '');
  const [status, setStatus] = useState(row?.status || 'online');
  const [busy, setBusy] = useState(false);

  const formRef = useRef(null);
  const codeRef = useRef(null);

  // ✅ ตรวจซ้ำ (ไม่คิดซ้ำกับเรคคอร์ดตัวเองตอนแก้ไข)
  const codeClash = useMemo(() => {
    const c = String(rig_code || '').trim().toLowerCase();
    if (!c) return false;
    return (existingRigs || []).some(r =>
      String(r.rig_code || '').trim().toLowerCase() === c && r.id !== (row?.id ?? -1)
    );
  }, [rig_code, existingRigs, row?.id]);

  useEffect(() => {
    // อัปเดต customValidity ของช่อง rig_code ให้สอดคล้องกับการชนซ้ำแบบสดๆ
    if (!codeRef.current) return;
    if (codeClash) codeRef.current.setCustomValidity('This rig code already exists.');
    else codeRef.current.setCustomValidity('');
  }, [codeClash]);

  const toNum = (v) => {
    const n = Number(String(v ?? '').trim());
    return Number.isFinite(n) ? n : null; // (จะไม่ถึงจุดนี้ถ้า validation ผ่าน)
  };

  async function submit(e){
    e.preventDefault();

    // กันเคสขึ้นต้น/ลงท้ายด้วยช่องว่างแบบไม่ตั้งใจ
    const trimmedCode = String(rig_code).trim();

    // รายงาน invalid ทันทีถ้ามี
    if (formRef.current && !formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }
    // ตรวจซ้ำอีกชั้น ป้องกัน race (เช่น มีการสร้าง code ใหม่ระหว่างที่ modal เปิดอยู่)
    const dupNow = (existingRigs || []).some(r =>
      String(r.rig_code || '').trim().toLowerCase() === trimmedCode.toLowerCase() &&
      r.id !== (row?.id ?? -1)
    );
    if (dupNow) {
      alert('Rig code already exists. Please choose another.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        rig_code: trimmedCode,
        name: String(name).trim(),
        location: String(location).trim(), // required แล้ว
        lat: toNum(lat),
        lon: toNum(lon),
        capacity: toNum(capacity),
        status
      };
      if (row) {
        await updateRig(row.id, payload);
        onSaved?.('update'); // แจ้งโหมดให้ parent ทำ toast
      } else {
        await createRig(payload);
        onSaved?.('create'); // แจ้งโหมดให้ parent ทำ toast
      }
    } catch (e) {
      alert(e?.response?.data?.message || 'Save failed');
    } finally { setBusy(false); }
  }

  const onNumKeydownNoSign = (e) => {
    if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
  };

  // กันการ paste ที่ไม่ใช่ตัวเลขล้วน
  const onPasteDigitsOnly = (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (/[^0-9]/.test(text)) e.preventDefault();
  };
  
  return (
    <div className="modal-backdrop" onMouseDown={(e)=>{ if (e.target===e.currentTarget) onClose?.(); }}>
      <div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <h3 className="modal-title">{row ? 'Edit rig' : 'Create rig'}</h3>

        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">

            <label className="block">
              <div className="muted text-xs mb-1">Rig code</div>
              <input
                ref={codeRef}
                className="input w-full"
                placeholder="e.g. RIG-A"
                value={rig_code}
                onChange={e=>setRigCode(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity(codeClash ? 'This rig code already exists.' : 'Please fill in all the information correctly.')}
                onInput={e => e.target.setCustomValidity(codeClash ? 'This rig code already exists.' : '')}
              />
              {codeClash && (
                <div className="muted" style={{ color:'#f87171', fontSize:12, marginTop:6 }}>
                  This rig code already exists. Please choose another.
                </div>
              )}
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">Name</div>
              <input
                className="input w-full"
                placeholder="e.g. Rig A"
                value={name}
                onChange={e=>setName(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information correctly.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="muted text-xs mb-1">Location</div>
              <input
                className="input w-full"
                placeholder="e.g. Gulf of Thailand"
                value={location}
                onChange={e=>setLocation(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information correctly.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">Lat</div>
              <input
                className="input w-full"
                type="number"
                step="any"
                min="-90"
                max="90"
                placeholder="e.g. 13.111110 (Min -90 Max 90)"
                value={lat}
                onChange={e=>setLat(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information correctly.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">Lon</div>
              <input
                className="input w-full"
                type="number"
                step="any"
                min="-180"
                max="180"
                placeholder="e.g. 99.124100 (Min -180 Max 180)"
                value={lon}
                onChange={e=>setLon(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information correctly.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">Capacity</div>
              <input
                className="input w-full"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max="10000000"
                placeholder="e.g. 50000 (Min 1 Max 10000000)"
                value={capacity}
                onChange={(e)=>setCapacity(e.target.value)}
                onKeyDown={onNumKeydownNoSign}
                onPaste={onPasteDigitsOnly}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information correctly.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || codeClash}>{row ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
