// src/pages/OilDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listRigs } from '../api/rigs';
import { getLatestPerRig } from '../api/readings';
import { listLotsByRig } from '../api/lots';
import IssueModal from '../components/IssueModal';
import RealtimeDailyChart from '../components/RealtimeDailyChart';
import LotDetailModal from '../components/LotDetailModal';

export default function OilDashboard() {
  const [rigs, setRigs] = useState([]);
  const [rigId, setRigId] = useState(null);

  // วันที่สำหรับกราฟ
  const [date, setDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  });

  const [latest, setLatest] = useState([]);
  const [lots, setLots] = useState([]);

  // โมดัล report + context
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueCtx, setIssueCtx] = useState({
    type: 'oil',
    rigId: null,
    readingId: null,
    lotId: null,
  });

  const [viewLot, setViewLot] = useState(null);

  // ===== Ref สำหรับ date picker ใน-field icon =====
  const dateRef = useRef(null);
  const openDatePicker = () => {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };
  // =================================================

  // โหลดรายชื่อแท่น
  useEffect(() => {
    (async () => {
      const rs = await listRigs();
      setRigs(rs);
      if (rs.length) setRigId(rs[0].id);
    })();
  }, []);

  // latest per rig
  const refreshTop = async () => setLatest(await getLatestPerRig());
  useEffect(() => {
    refreshTop();
    const t = setInterval(refreshTop, 5000);
    return () => clearInterval(t);
  }, []);

  // lots ของแท่นที่เลือก
  const loadLots = async (id) => {
    if (!id) return setLots([]);
    setLots(await listLotsByRig(id, { limit: 20 }));
  };
  useEffect(() => { loadLots(rigId); }, [rigId]);

  const latestByRig = useMemo(
    () => Object.fromEntries(latest.map((r) => [r.rig_id, r])),
    [latest]
  );
  const last = latestByRig[rigId];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Production Dashboard</h1>

        {/* Report current oil issue (type=oil) */}
        <button
          onClick={() => {
            setIssueCtx({
              type: 'oil',
              rigId,
              readingId: last?.id || null, // id ของ reading ล่าสุด
              lotId: null,
            });
            setIssueOpen(true);
          }}
          className="btn btn-primary-report-current "
        >
          Report current reading issue
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <span className="muted">Rig</span>
            <select
              className="select"
              value={rigId || ''}
              onChange={(e) => setRigId(Number(e.target.value))}
            >
              {rigs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rig_code || `RIG-${r.id}`} — {r.name}
                </option>
              ))}
            </select>
            

            <span className="muted">Date</span>
            <div className="flex flex-col"></div>
            <div className="dt2">
              <input
                ref={dateRef}
                type="date"
                className="select dt2-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                type="button"
                className="dt2-icon"
                onClick={openDatePicker}
                aria-label="Pick date"
                title="Pick date"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="muted text-sm">
            Last reading: {last?.recorded_at?.replace('T', ' ').slice(0, 19) || '-'}
          </div>
        </div>

        <RealtimeDailyChart rigId={rigId} date={date} height={380} />
      </div>

      {/* ตาราง lots */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Lots (latest)</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Lot ID</th>
                <th>Lot date</th>
                <th>Status</th>
                <th>Total qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr
                  key={l.id}
                  className="clickable"
                  onClick={() => setViewLot(l)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setViewLot(l)}
                >
                  <td className="font-mono">#{l.id}</td>
                  <td>{l.lot_date}</td>
                  <td>{l.status}</td>
                  <td>{Number(l.total_qty || 0).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIssueCtx({
                          type: 'lot',
                          rigId,
                          readingId: null,
                          lotId: l.id,
                        });
                        setIssueOpen(true);
                      }}
                    >
                      Report issue
                    </button>
                  </td>
                </tr>
              ))}
              {!lots.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No lots
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* โมดัลสร้าง issue */}
      <IssueModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        defaultType={issueCtx.type}
        defaultRigId={issueCtx.rigId}
        defaultReadingId={issueCtx.readingId}
        defaultLotId={issueCtx.lotId}
      />

      {/* Modal ดูรายละเอียดล็อต */}
      <LotDetailModal lot={viewLot} rigId={rigId} onClose={() => setViewLot(null)} />

      {/* ===== Scoped styles for in-field calendar icon (ใช้ร่วมกับ IssuesList) ===== */}
      <style>{CSS_DT2}</style>
    </div>
  );
}

/* Scoped CSS เฉพาะคอมโพเนนต์นี้ (ถ้าย้ายไป global ได้, ย้ายบล็อกนี้ไป styles.css แล้วลบ <style> ข้างบนได้เลย) */
const CSS_DT2 = `
.dt2 {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.dt2-input {
  padding-right: 44px !important;
  min-width: 350px;
}
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
/* ป้องกันไอคอนโดนบังในบาง browser */
.dt2-input::-ms-clear { display: none; }
`;
