import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listVessels, listLatestPositions, createVessel } from '../api/vessels';
import { listShipments } from '../api/shipments';       // ✅ เพิ่ม
import IssueModal from '../components/IssueModal';

const POLL_MS = 10000;          // refresh every 10s
const SPEED_LIMIT = 15;         // overspeed threshold (kn)

function fmt(n, d = 2) { return n == null ? '-' : Number(n).toFixed(d); }
function fmtDeg(n)      { return n == null ? '-' : `${Number(n).toFixed(0)}°`; }
function fmtTime(ts) { if (!ts) return '-'; return String(ts).replace('T',' ').slice(0,19); }
const cx = (...a) => a.filter(Boolean).join(' ');
const dedupeById = (arr=[]) => Array.from(new Map(arr.map(x=>[+x.id,x])).values());

// ---------- Small UI bits ----------
const StatusPill = ({ status }) => {
  const map = {
    sailing: { dot:'#3b82f6', cls:'chip blue' },
    loading: { dot:'#f59e0b', cls:'chip amber' },
    idle:    { dot:'#9ca3af', cls:'chip gray' },
  };
  const o = map[status] || map.idle;
  return (
    <span className={o.cls}><span className="dot" style={{background:o.dot}} />{status || '-'}</span>
  );
};

// ---------- Add Vessel Modal ----------
function AddVesselModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [no, setNo] = useState('');
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => first.current?.focus(), 50);
    } else {
      setName(''); setNo(''); setCap('');
    }
  }, [open]);

  async function submit(e) {
    e?.preventDefault?.();
    if (!name.trim()) return alert('Please enter vessel name');
    const capacity = cap.trim() === '' ? null : Number(cap);
    if (cap.trim() !== '' && Number.isNaN(capacity)) return alert('Capacity must be a number');

    try {
      setBusy(true);
      await createVessel({ name: name.trim(), vessel_no: no.trim() || null, capacity, status: 'idle' });
      onCreated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert('Failed to create vessel');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e)=>{ if (e.target===e.currentTarget) onClose?.(); }}>
      <form className="modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
        <h3 className="modal-title">Add new vessel</h3>

        <label className="block">
          <div className="muted text-xs mb-1">Vessel name</div>
          <input ref={first} className="input w-full" value={name} onChange={e=>setName(e.target.value)} />
        </label>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <label className="block">
            <div className="muted text-xs mb-1">Vessel No (optional)</div>
            <input className="input w-full" value={no} onChange={e=>setNo(e.target.value)} />
          </label>
          <label className="block">
            <div className="muted text-xs mb-1">Capacity (optional)</div>
            <input className="input w-full" value={cap} onChange={e=>setCap(e.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- History Modal (shipments) ----------
function VesselHistoryModal({ vessel, open, onClose, onReport }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !vessel?.id) return;
    setLoading(true);
    (async () => {
      try {
        const data = await listShipments({ vessel_id: vessel.id, limit: 50 });
        setRows(Array.isArray(data) ? data : []);
      } finally { setLoading(false); }
    })();
  }, [open, vessel?.id]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e)=>{ if (e.target===e.currentTarget) onClose?.(); }}>
      <div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <h3 className="modal-title">Voyage history — {vessel?.name || `#${vessel?.id}`}</h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{width:80}}>ID</th>
                <th>Origin rig</th>
                <th>Destination</th>
                <th style={{width:170}}>Depart</th>
                <th style={{width:170}}>Arrive</th>
                <th style={{width:120}}>Status</th>
                <th style={{width:160}} className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="muted">Loading…</td></tr>}
              {!loading && !rows.length && <tr><td colSpan={7} className="muted">No voyages</td></tr>}
              {!loading && rows.map(sh => (
                <tr key={sh.id}>
                  <td>#{sh.id}</td>
                  <td className="muted">{sh.origin_rig_id ?? '-'}</td>
                  <td>{sh.destination || '-'}</td>
                  <td className="muted">{fmtTime(sh.depart_at)}</td>
                  <td className="muted">{fmtTime(sh.arrive_at)}</td>
                  <td>{sh.status}</td>
                  <td className="text-right">
                    <button
                      className="btn btn-ghost"
                      onClick={() => onReport({
                        type: 'shipment',
                        vesselId: vessel.id,
                        shipmentId: sh.id,
                        defaultTitle: `Issue on voyage #${sh.id}`
                      })}
                    >
                      Report issue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-3">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function VesselDashboard() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // all | sailing | idle | loading
  const [q, setQ]             = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // สำหรับ History + IssueModal
  const [histOpen, setHistOpen] = useState(false);
  const [histVessel, setHistVessel] = useState(null);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueDefaults, setIssueDefaults] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const [vessels, latest] = await Promise.all([listVessels(), listLatestPositions()]);

      const posMap = new Map();
      (latest || []).forEach(p =>
        posMap.set(Number(p.vessel_id), {
          recorded_at: p.recorded_at,
          lat: p.lat != null ? Number(p.lat) : null,
          lon: p.lon != null ? Number(p.lon) : null,
          speed: p.speed != null ? Number(p.speed) : null,
          course: p.course != null ? Number(p.course) : null,
        })
      );

      const merged = dedupeById(vessels).map(v => ({ ...v, last: posMap.get(Number(v.id)) || null }));
      setRows(merged);
    } catch (err) {
      console.error('[Vessels] load error', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const uniqRows = useMemo(() => dedupeById(rows), [rows]);

  const counts = useMemo(() => ({
    all:     uniqRows.length,
    sailing: uniqRows.filter(r => r.status === 'sailing').length,
    idle:    uniqRows.filter(r => r.status === 'idle').length,
    loading: uniqRows.filter(r => r.status === 'loading').length,
  }), [uniqRows]);

  const shown = useMemo(() => {
    let list = uniqRows;
    if (filter !== 'all') list = list.filter(r => r.status === filter);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      list = list.filter(r =>
        String(r.name || '').toLowerCase().includes(k) ||
        String(r.vessel_no || '').toLowerCase().includes(k)
      );
    }
    return dedupeById(list).sort((a,b) => a.id - b.id);
  }, [uniqRows, filter, q]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Vessels</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add vessel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-head">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['all',     `All (${counts.all})`],
              ['sailing', `Sailing (${counts.sailing})`],
              ['idle',    `Idle (${counts.idle})`],
              ['loading', `Loading (${counts.loading})`],
            ].map(([key,label]) => (
              <button
                key={key}
                className={`btn ${filter===key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              className="input"
              placeholder="Search by name / vessel no / IMO"
              value={q}
              onChange={e=>setQ(e.target.value)}
              style={{minWidth:280}}
            />
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{width:70}}>ID</th>
                <th>Name</th>
                <th>Vessel No</th>
                <th style={{width:120}}>Status</th>
                <th style={{width:140}}>Speed</th>
                <th style={{width:120}}>Course</th>
                <th style={{width:260}}>Last position</th>
                <th style={{width:260}} className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="muted">Loading…</td></tr>}
              {!loading && shown.length === 0 && <tr><td colSpan={8} className="muted">No vessels</td></tr>}

              {!loading && shown.map(v => {
                const showDetail = v.status !== 'idle';
                const p = v.last;
                const isOver = v.status === 'sailing' && p && p.speed != null && p.speed > SPEED_LIMIT;

                return (
                  <tr key={`v-${v.id}`} className="hoverable">
                    <td>#{v.id}</td>
                    <td>{v.name || '-'}</td>
                    <td>{v.vessel_no || '-'}</td>
                    <td><StatusPill status={v.status} /></td>

                    <td>
                      {showDetail && p ? (
                        <span className={isOver ? 'text-red-600 font-semibold' : ''}>
                          {fmt(p.speed)} kn {isOver && <span className="badge red ml-2">overspeed</span>}
                        </span>
                      ) : '-'}
                    </td>

                    <td>{showDetail && p ? fmtDeg(p.course) : '-'}</td>

                    <td>
                      {showDetail && p
                        ? `${fmt(p.lat,5)}, ${fmt(p.lon,5)} • ${fmtTime(p.recorded_at)}`
                        : '-'}
                    </td>

                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          className="btn btn-ghost"
                          onClick={() => { setHistVessel(v); setHistOpen(true); }}
                        >
                          History
                        </button>

                        {/* รายงานปัญหาแบบผูกกับ "เรือ" */}
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setIssueDefaults({ type:'vessel', vesselId: v.id, defaultTitle: '' });
                            setIssueOpen(true);
                          }}
                        >
                          Report issue
                        </button>

                        {/* one-click overspeed */}
                        {isOver && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setIssueDefaults({
                                type:'vessel',
                                vesselId: v.id,
                                defaultTitle: `Overspeed > ${SPEED_LIMIT} kn`
                              });
                              setIssueOpen(true);
                            }}
                          >
                            Report overspeed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="muted text-xs mt-3">
          * Details are hidden for vessels in <b>idle</b>. Overspeed threshold: {SPEED_LIMIT} kn.
        </p>
      </div>

      {/* Modals */}
      <AddVesselModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} />

      <VesselHistoryModal
        open={histOpen}
        vessel={histVessel}
        onClose={() => setHistOpen(false)}
        onReport={({ type, vesselId, shipmentId, defaultTitle }) => {
          setHistOpen(false);
          setIssueDefaults({ type, vesselId, shipmentId, defaultTitle });
          setIssueOpen(true);
        }}
      />

      {/* ✅ ใช้ IssueModal แบบ lockType + รองรับ shipment */}
      {issueOpen && (
        <IssueModal
          open={issueOpen}
          onClose={(ok)=>{ setIssueOpen(false); if (ok) load(); }}
          lockType
          defaultType={issueDefaults?.type || 'vessel'}
          defaultVesselId={issueDefaults?.vesselId ?? null}
          defaultShipmentId={issueDefaults?.shipmentId ?? null}
          defaultTitle={issueDefaults?.defaultTitle || ''}
        />
      )}

      {/* Scoped styles to match Issues theme */}
      <style>{`
        .chip{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb;color:#111827}
        .chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%}
        .chip.blue{background:#eff6ff;border-color:#dbeafe;color:#1d4ed8}
        .chip.amber{background:#fffbeb;border-color:#fde68a;color:#b45309}
        .chip.gray{background:#f3f4f6;border-color:#e5e7eb;color:#374151}
        .badge.red{font-size:11px;padding:2px 6px;border-radius:6px;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca}
      `}</style>
    </div>
  );
}
