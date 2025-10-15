// frontend/src/components/IssueWorkModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { submitIssueReport, approveIssue, rejectIssue } from '../api/issues';

export default function IssueWorkModal({ row, role, onClose, onChanged }) {
  const [files, setFiles] = useState([]);              // File[]
  const [previews, setPreviews] = useState([]);        // [{url,name,size}]
  const [finishAt, setFinishAt] = useState('');
  const [report, setReport] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // --- Lightbox state (ฝังในไฟล์นี้ ไม่ต้อง import เพิ่ม) ---
  const [viewer, setViewer] = useState({ open: false, index: 0, images: [] });
  const openViewerFromPreviews = (i) =>
    setViewer({ open: true, index: i, images: previews.map(p => p.url) });
  const openViewerFromServer = (i) =>
    setViewer({ open: true, index: i, images: (row.photos || []).map(p => p.file_path) });

  const editable = row.status === 'in_progress' || row.status === 'need_rework';
  const canFleetApprove = (row.status === 'awaiting_fleet_approval') && (role === 'fleet' || role === 'captain');
  const canMgrApprove   = (row.status === 'awaiting_manage_approval') && (role === 'manager' || role === 'admin');

  // previews
  useEffect(() => {
    previews.forEach(p => URL.revokeObjectURL(p.url));
    const next = (files || []).map(f => ({ url: URL.createObjectURL(f), name: f.name, size: f.size }));
    setPreviews(next);
    // revoke on unmount
    return () => next.forEach(p => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  // pick from input
  const onPick = (e) => {
    const list = Array.from(e.target.files || []);
    addFiles(list);
  };

  // drag & drop
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const list = Array.from(e.dataTransfer?.files || []);
    addFiles(list);
  };
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };

  // only images + de-duplicate by name+size
  const addFiles = (list) => {
    const imgs = list.filter(f => /^image\/(png|jpe?g|webp|gif)$/i.test(f.type));
    if (!imgs.length) return;
    setFiles(prev => {
      const map = new Map(prev.map(f => [f.name + ':' + f.size, f]));
      imgs.forEach(f => map.set(f.name + ':' + f.size, f));
      return Array.from(map.values()).slice(0, 10); // cap 10 images
    });
  };

  const removeAt = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const doSubmit = async () => {
    if (!report.trim()) return alert('Please fill in the Cause and Action Report.');
    if (files.length === 0) return alert('Please attach at least one photo.');
    setBusy(true);
    try {
      await submitIssueReport(row.id, { finish_time: finishAt, action_report: report, files });
      onChanged?.(row.id);
      onClose?.();
    } catch (e) {
      alert('Submit failed');
    } finally { setBusy(false); }
  };

  const doApprove = async () => {
    setBusy(true);
    try {
      const res = await approveIssue(row.id); // คาดหวัง { status, finish_time, approved_at }
      // อัปเดตข้อมูลในจอให้เห็นทันที (ถ้ามี)
      if (res?.finish_time) row.finish_time = res.finish_time;
      if (res?.status) row.status = res.status;
      onChanged?.(row.id);
      onClose?.();
    } catch {
      alert('Approve failed');
    } finally { setBusy(false); }
  };

  const doReject = async () => {
    if (!confirm('Send back for rework? Photos and report text will be removed.')) return;
    setBusy(true);
    try { await rejectIssue(row.id); onChanged?.(row.id); onClose?.(); }
    catch { alert('Reject failed'); }
    finally { setBusy(false); }
  };

  // helpers
  const fmtDT = (ts) => (ts || '').replace('T', ' ').slice(0, 16);
  const typeLabel = useMemo(() => (row.type === 'oil' ? 'Oil Rig Problems' : row.type), [row.type]);

  return (
    <div className="iwm-backdrop" onMouseDown={e=>{ if (e.target===e.currentTarget) onClose?.(); }}>
      <div className="iwm-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="iwm-head">
          <button className="iwm-back" onClick={onClose} aria-label="Close">←</button>
          <h3>Report Incident</h3>
        </div>

        <div className="iwm-body">
          {/* Read-only header rows */}
          <KV k="Notice Topic :" v={row.title} />
          <KV k="Start Date and Time :" v={fmtDT(row.anchor_time)} />
          <KV k="Type :" v={typeLabel} />
          <KV k="Severity :" v={row.severity} />

          {/* โชว์รายละเอียดแบบอ่านง่ายขึ้น */}
            {/* Issue details as plain text */}
            <KV k="Issue Details :">
            <div className="iwm-plain">{row.description || '-'}</div>
            </KV>
          {editable ? (
            <>
              <KV k="Finish Date and Time :">
                <input
                  type="datetime-local"
                  className="iwm-input"
                  value={finishAt}
                  onChange={(e)=>setFinishAt(e.target.value)}
                />
              </KV>

              <div className="iwm-field">
                <div className="iwm-label">Cause and Action Report:</div>
                <textarea
                  className="iwm-input"
                  rows={6}
                  value={report}
                  onChange={(e)=>setReport(e.target.value)}
                  placeholder="Provide a detailed description of what really happened and corrective actions..."
                />
              </div>

              <div className="iwm-field">
                <div className="iwm-label">Attach Photo(s) :</div>

                {/* Upload box */}
                <div
                  className={`iwm-drop ${dragging ? 'drag' : ''}`}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={()=>inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e)=> (e.key==='Enter' || e.key===' ') && inputRef.current?.click()}
                  aria-label="Upload a file or drag and drop"
                >
                  <div className="iwm-plus">＋</div>
                  <div className="iwm-upload-title">Upload a File</div>
                  <div className="iwm-or">or</div>
                  <div className="iwm-dnd">Drag and Drop</div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={onPick}
                    style={{display:'none'}}
                  />
                </div>

                {/* Previews */}
                {previews.length > 0 && (
                  <div className="iwm-grid">
                    {previews.map((p, i) => (
                      <div key={p.url} className="iwm-thumb">
                        {/* คลิกเพื่อขยาย */}
                        <img
                          src={p.url}
                          alt={p.name}
                          onClick={() => openViewerFromPreviews(i)}
                          title="Click to view"
                          style={{ cursor: 'zoom-in' }}
                        />
                        <button
                          className="iwm-remove"
                          onClick={(e)=>{ e.stopPropagation(); removeAt(i); }}
                          title="Remove"
                          type="button"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="iwm-foot right">
                <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
                <button className="btn primary" onClick={doSubmit} disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </>
          ) : (
            <>
              <KV k="Finish Date and Time :" v={fmtDT(row.finish_time) || '-'} />

              <div className="iwm-field">
                <div className="iwm-label">Cause and Action Report :</div>
                <div className="iwm-box iwm-box-lg">{row.action_report || '-'}</div>
              </div>

              {!!(row.photos||[]).length && (
                <div className="iwm-field">
                  <div className="iwm-label">Attach Photo(s) :</div>
                  <div className="iwm-grid">
                    {row.photos.map((p, i) => (
                      <div key={p.id} className="iwm-thumb readonly">
                        {/* คลิกเพื่อขยาย */}
                        <img
                          src={p.file_path}
                          alt=""
                          onClick={() => openViewerFromServer(i)}
                          title="Click to view"
                          style={{ cursor: 'zoom-in' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(canFleetApprove || canMgrApprove) ? (
                <div className="iwm-foot center">
                  <button className="btn primary" onClick={doApprove} disabled={busy}>Approve</button>
                  <button className="btn danger" onClick={doReject} disabled={busy}>Reject</button>
                </div>
              ) : (
                <div className="iwm-foot right">
                  <button className="btn primary" onClick={onClose}>Close</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lightbox viewer */}
        {viewer.open && (
          <LightboxInline
            images={viewer.images}
            index={viewer.index}
            onClose={() => setViewer(v => ({ ...v, open: false }))}
            onIndex={(i) => setViewer(v => ({ ...v, index: i }))}
          />
        )}

        <style>{css}</style>
      </div>
    </div>
  );
}

function KV({ k, v, children }) {
  return (
    <div className="iwm-kv">
      <div className="iwm-k">{k}</div>
      <div className="iwm-v">{children ?? v}</div>
    </div>
  );
}

/* ---------- Inline Lightbox Component (ไม่มี dependency) ---------- */
function LightboxInline({ images = [], index = 0, onIndex, onClose }) {
  const [i, setI] = useState(index);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => setI(index), [index]);
  useEffect(() => onIndex?.(i), [i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') setI((p) => (p + 1) % images.length);
      if (e.key === 'ArrowLeft') setI((p) => (p - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  function wheel(e) {
    e.preventDefault();
    const next = Math.min(5, Math.max(1, scale + (e.deltaY < 0 ? 0.2 : -0.2)));
    setScale(next);
  }
  function onDown(e) {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }
  function onMove(e) {
    if (!dragging.current || scale === 1) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }
  function onUp() { dragging.current = false; }
  function resetView() { setScale(1); setOffset({ x: 0, y: 0 }); }

  return (
    <div className="lbk-backdrop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="lbk-ui">
        <button className="lbk-close" onClick={onClose}>Close</button>
        <button className="lbk-left"  onClick={() => setI((p)=> (p-1+images.length)%images.length)}>&larr;</button>
        <button className="lbk-right" onClick={() => setI((p)=> (p+1)%images.length)}>&rarr;</button>
      </div>
      <div className="lbk-stage" onWheel={wheel}>
        <img
          src={images[i]}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          className="lbk-img"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, cursor: scale>1? 'grab':'auto' }}
          alt=""
        />
      </div>
      <div className="lbk-toolbar">
        <button onClick={()=> setScale((s)=> Math.min(5, s+0.2))}>Zoom +</button>
        <button onClick={()=> setScale((s)=> Math.max(1, s-0.2))}>Zoom -</button>
        <button onClick={resetView}>Reset</button>
        <span className="lbk-hint">Scroll = zoom, drag = pan, Esc = close</span>
      </div>
    </div>
  );
}

const css = `
.iwm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:60}
.iwm-modal{width:min(980px,96vw);background:#0f172a;border:1px solid #1f2937;border-radius:16px;color:#e5e7eb;box-shadow:0 24px 70px rgba(0,0,0,.5);overflow:hidden}
.iwm-head{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #1f2937}
.iwm-head h3{margin:0;font-size:26px;font-weight:700;letter-spacing:.2px}
.iwm-back{border:none;background:transparent;color:#9ca3af;font-size:22px;cursor:pointer}
.iwm-body{padding:22px 24px;display:flex;flex-direction:column;gap:16px}

.iwm-kv{display:flex;gap:18px;align-items:flex-start}
.iwm-k{width:240px;color:#9ca3af}
.iwm-v{flex:1}

.iwm-field{display:flex;flex-direction:column;gap:8px}
.iwm-label{color:#9ca3af}
.iwm-input{width:100%;border:1px solid #374151;background:#0b1220;color:#e5e7eb;border-radius:12px;padding:12px 14px}
.iwm-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
.iwm-box{border:1px solid #374151;background:#0b1220;color:#e5e7eb;border-radius:12px;padding:14px;white-space:pre-wrap;min-height:120px}

/* bigger, scrollable text box for long details */
.iwm-box-lg{min-height:160px;max-height:260px;overflow:auto;white-space:pre-wrap;line-height:1.45}

.iwm-drop{
  border:1.5px dashed #334155;
  border-radius:14px;
  background:#0b1220;
  padding:24px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-direction:column;
  gap:6px;
  cursor:pointer;
  transition:all .15s ease;
}
.iwm-drop.drag{border-color:#60a5fa;background:#0b1220cc}
.iwm-plus{font-size:32px;line-height:1.1;color:#94a3b8}
.iwm-upload-title{color:#d1d5db;font-weight:600}
.iwm-or{color:#64748b;font-size:12px}
.iwm-dnd{color:#9ca3af;font-size:12px}

.iwm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:10px}
.iwm-thumb{position:relative;border-radius:10px;overflow:hidden;border:1px solid #334155;background:#111827}
.iwm-thumb img{width:100%;height:100%;object-fit:cover;display:block;aspect-ratio:4/3}
.iwm-thumb.readonly .iwm-remove{display:none}
.iwm-remove{
  position:absolute;top:6px;right:6px;
  width:24px;height:24px;border-radius:999px;border:none;
  background:#ef4444;color:#fff;cursor:pointer;line-height:24px;font-weight:700;
  box-shadow:0 2px 6px rgba(0,0,0,.25)
}

.iwm-foot{display:flex;gap:10px;margin-top:16px}
.iwm-foot.right{justify-content:flex-end}
.iwm-foot.center{justify-content:center}

.btn{padding:10px 16px;border:1px solid #334155;background:#0b1220;color:#e5e7eb;border-radius:999px;cursor:pointer}
.btn.ghost{background:#0b1220}
.btn.primary{background:#3b82f6;border-color:#3b82f6;color:#fff}
.btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}

/* ---- Lightbox styles ---- */
.lbk-backdrop{position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:70;}
/* ไม่ให้ stage กินคลิกทับปุ่ม */
.lbk-stage{position:absolute; inset:0; z-index:0; display:grid; place-items:center; pointer-events:none;}
.lbk-img{max-width:95vw; max-height:85vh; user-select:none; pointer-events:auto;}
/* ปุ่มลอยบนสุดและคลิกได้ */
.lbk-ui{position:absolute; inset:0; z-index:3; pointer-events:none;}
.lbk-ui .lbk-close, .lbk-ui .lbk-left, .lbk-ui .lbk-right{pointer-events:auto;}
.lbk-ui .lbk-close{position:absolute; top:16px; right:16px; background:#fff; color:#000; border:none; border-radius:10px; padding:6px 10px; cursor:pointer;}
.lbk-ui .lbk-left, .lbk-ui .lbk-right{
  position:absolute; top:50%; transform:translateY(-50%);
  background:rgba(255,255,255,.14); color:#fff; border:none; border-radius:10px;
  padding:10px 12px; cursor:pointer;
}
.lbk-ui .lbk-left{ left:16px; }
.lbk-ui .lbk-right{ right:16px; }
.lbk-toolbar{position:absolute; left:50%; bottom:16px; transform:translateX(-50%); z-index:3; display:flex; gap:8px; color:#fff; align-items:center;}
.lbk-toolbar button{background:rgba(255,255,255,.14); color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer}
.lbk-hint{ opacity:.85; font-size:12px; margin-left:6px; }
`;
