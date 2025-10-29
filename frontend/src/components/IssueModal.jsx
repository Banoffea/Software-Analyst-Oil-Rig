// src/components/IssueModal.jsx
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { createIssue } from "../api/issues";
import { useAuth } from "../utils/auth.jsx"; // ⬅️ ใช้ role ของผู้ใช้

// "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
function nowLocalForInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function makeAutoTitle(type, { shipmentId, vesselId, lotId, rigId }) {
  switch (type) {
    case "shipment":
      if (shipmentId) return `Issue on voyage #${shipmentId}`;
      if (vesselId) return `Issue on vessel #${vesselId} (voyage)`;
      return "Shipment issue";
    case "vessel":
      return vesselId ? `Vessel #${vesselId} issue` : "Vessel issue";
    case "lot":
      return lotId ? `Lot #${lotId} issue` : "Lot issue";
    case "oil":
      return rigId ? `Rig #${rigId} issue` : "Oil issue";
    default:
      return "Issue";
  }
}

export default function IssueModal({
  open,
  onClose,
  defaultType = "oil",
  defaultRigId = null,
  defaultLotId = null,
  defaultVesselId = null,
  defaultVesselPosId = null,
  defaultShipmentId = null,
  lockType = false,
  defaultTitle = "", // จะถูก "เมิน" แล้ว (ไม่ auto-fill)
}) {
  const { me } = useAuth();
  const isAdmin = me?.role === "admin"; // ⬅️ กัน admin ไม่ให้รายงาน

  const firstFieldRef = useRef(null);
  const descRef = useRef(null);

  // form state
  const [type, setType] = useState(defaultType);
  const [rigId, setRigId] = useState(defaultRigId ?? "");
  const [lotId, setLotId] = useState(defaultLotId ?? "");
  const [vesselId, setVesselId] = useState(defaultVesselId ?? "");
  const [vposId, setVposId] = useState(defaultVesselPosId ?? "");
  const [shipmentId, setShipmentId] = useState(defaultShipmentId ?? "");

  const [severity, setSeverity] = useState("");
  const [title, setTitle] = useState("");             // ⬅️ ไม่มี default title แล้ว
  const [titleTouched, setTitleTouched] = useState(false);
  const [desc, setDesc] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  // occur time -> sent as anchor_time
  const [anchorAt, setAnchorAt] = useState(nowLocalForInput());
  const [busy, setBusy] = useState(false);

  // lock when opened from context
  const derivedLock =
    lockType ||
    (defaultType === "oil" && defaultRigId != null) ||
    (defaultType === "lot" && defaultLotId != null) ||
    (defaultType === "vessel" && defaultVesselId != null) ||
    (defaultType === "shipment" && (defaultShipmentId != null || defaultVesselId != null));

  // reset when opened
  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setRigId(defaultRigId ?? "");
    setLotId(defaultLotId ?? "");
    setVesselId(defaultVesselId ?? "");
    setVposId(defaultVesselPosId ?? "");
    setShipmentId(defaultShipmentId ?? "");
    setSeverity("");
    setDesc("");
    setTriedSubmit(false);
    setAnchorAt(nowLocalForInput());
    setTitle("");                 // ⬅️ reset เป็นค่าว่างเสมอ
    setTitleTouched(false);       // ⬅️ ไม่ถือว่าผู้ใช้เคยแก้

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    defaultType,
    defaultRigId,
    defaultLotId,
    defaultVesselId,
    defaultVesselPosId,
    defaultShipmentId,
    defaultTitle, // อยู่ใน deps ได้ แต่จะไม่ถูกใช้
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !busy && onClose?.(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  // ==== Admin view: แสดงหน้าว่าง + ข้อความ และปุ่มปิดเท่านั้น ====
  if (isAdmin) {
    return createPortal(
      <div className="imodal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(false); }}>
        <div className="imodal imodal-blank" onMouseDown={(e) => e.stopPropagation()}>
          <div className="imodal-blank-content">
            <h3 className="imodal-blank-title">Reporting is disabled for admin</h3>
            <p className="imodal-blank-msg">
              Admin users cannot report issues. Please ask a permitted role to submit a report.
            </p>
            <button className="btn primary" onClick={() => onClose?.(false)}>Close</button>
          </div>
        </div>
        <style>{CSS}</style>
      </div>,
      document.body
    );
  }

  const descOk = (desc || "").trim().length > 0;
  const showDescError = triedSubmit && !descOk;

  const submit = async (e) => {
    e.preventDefault();
    setTriedSubmit(true);

    const descTrimmed = (desc || "").trim();
    if (!descTrimmed) {
      descRef.current?.focus();
      return;
    }

    if (!severity) {
      alert("Please select severity.");
      return;
    }

    // build payload
    const payload = {
      type,
      severity,
      title,
      description: descTrimmed,
      anchor_time: anchorAt ? anchorAt.replace("T", " ") + ":00" : undefined,
    };

    if (type === "oil") {
      if (rigId) payload.rig_id = Number(rigId);
    } else if (type === "lot") {
      if (lotId) payload.lot_id = Number(lotId);
    } else if (type === "vessel") {
      if (vesselId) payload.vessel_id = Number(vesselId);
      if (vposId) payload.vessel_position_id = Number(vposId); // optional
    } else if (type === "shipment") {
      if (shipmentId) payload.shipment_id = Number(shipmentId); // optional
      if (vesselId) payload.vessel_id = Number(vesselId); // optional
    }

    setBusy(true);
    try {
      await createIssue(payload);
      onClose?.(true);
    } catch (err) {
      alert(err?.response?.data?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const onBackdrop = (e) => {
    if (e.target === e.currentTarget && !busy) onClose?.(false);
  };

  return createPortal(
    <div className="imodal-backdrop" onMouseDown={onBackdrop} role="dialog" aria-modal="true">
      <div className="imodal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="imodal-head">
          <h3>Report an issue</h3>
        </div>

        <form onSubmit={submit} className="imodal-body">
          {!derivedLock ? (
            <div className="grid2">
              <label className="f">
                <span>Type</span>
                <select
                  ref={firstFieldRef}
                  className="in"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setTitleTouched(false);
                  }}
                >
                  <option value="oil">Oil (current reading)</option>
                  <option value="lot">Lot</option>
                  <option value="vessel">Vessel</option>
                  <option value="shipment">Shipment</option>
                </select>
              </label>
              <label className="f">
                <span>Severity</span>
                <select className="in" value={severity} onChange={(e) => setSeverity(e.target.value)} required>
                  <option value="" disabled hidden>-- Select severity --</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="grid2">
              <div className="f">
                <span>Type</span>
                <div className="chip">
                  {defaultType === "oil"
                    ? "Oil (current reading)"
                    : defaultType === "shipment"
                    ? "Shipment"
                    : defaultType[0].toUpperCase() + defaultType.slice(1)}
                </div>
              </div>
              <label className="f">
                <span>Severity</span>
                <select className="in" value={severity} onChange={(e) => setSeverity(e.target.value)} required>
                  <option value="" disabled hidden>-- Select severity --</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
          )}

          {/* When did it occur */}
          <label className="f">
            <span>When did it occur?</span>
            <div className="row">
              <input
                type="datetime-local"
                className="input-datetime in"
                value={anchorAt}
                onChange={(e) => setAnchorAt(e.target.value)}
              />
              <button type="button" className="btn ghost" onClick={() => setAnchorAt(nowLocalForInput())}>
                Now
              </button>
            </div>
          </label>

          {/* Context fields */}
          {type === "oil" &&
            (derivedLock ? (
              <div className="f">
                <span>Rig</span>
                <div className="chip">Rig #{rigId}</div>
              </div>
            ) : (
              <label className="f">
                <span>Rig ID</span>
                <input
                  className="in"
                  value={rigId}
                  onChange={(e) => {
                    setRigId(e.target.value);
                    setTitleTouched(false);
                  }}
                  required
                />
              </label>
            ))}

          {type === "lot" &&
            (derivedLock ? (
              <div className="f">
                <span>Lot</span>
                <div className="chip">Lot #{lotId}</div>
              </div>
            ) : (
              <label className="f">
                <span>Lot ID</span>
                <input
                  className="in"
                  value={lotId}
                  onChange={(e) => {
                    setLotId(e.target.value);
                    setTitleTouched(false);
                  }}
                  required
                />
              </label>
            ))}

          {type === "vessel" &&
            (derivedLock ? (
              <>
                <div className="f">
                  <span>Vessel</span>
                  <div className="chip">Vessel #{vesselId}</div>
                </div>
              </>
            ) : (
              <div className="grid2">
                <label className="f">
                  <span>Vessel ID</span>
                  <input
                    className="in"
                    value={vesselId}
                    onChange={(e) => {
                      setVesselId(e.target.value);
                      setTitleTouched(false);
                    }}
                    required
                  />
                </label>
              </div>
            ))}

          {type === "shipment" && (
            <>
              {defaultShipmentId != null ? (
                <div className="f">
                  <span>Shipment</span>
                  <div className="chip">Voyage #{shipmentId}</div>
                </div>
              ) : (
                <label className="f">
                  <span>Shipment ID (optional)</span>
                  <input
                    className="in"
                    value={shipmentId}
                    onChange={(e) => {
                      setShipmentId(e.target.value);
                      setTitleTouched(false);
                    }}
                  />
                </label>
              )}
              {defaultVesselId != null ? (
                <div className="f">
                  <span>Vessel</span>
                  <div className="chip">Vessel #{vesselId}</div>
                </div>
              ) : (
                <label className="f">
                  <span>Vessel ID (optional)</span>
                  <input
                    className="in"
                    value={vesselId}
                    onChange={(e) => {
                      setVesselId(e.target.value);
                      setTitleTouched(false);
                    }}
                  />
                </label>
              )}
              {defaultShipmentId == null && defaultVesselId == null && (
                <div className="muted" style={{ fontSize: 12 }}>
                  Provide <b>Shipment ID</b> or <b>Vessel ID</b> (at least one).
                </div>
              )}
            </>
          )}

          <label className="f">
            <span>Title</span>
            <input
              className="in"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              required
              placeholder={"e.g. " + makeAutoTitle(type, { shipmentId, vesselId, lotId, rigId })}
            />
          </label>

          {/* Description + error message */}
          <label className="f">
            <span>Description</span>
            <textarea
              ref={descRef}
              className={`in ${showDescError ? "error" : ""}`}
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe the problem, steps, impact, etc."
            />
            {showDescError && (
              <div className="err">Please fill in all the information.</div>
            )}
          </label>

          <div className="foot">
            <button type="button" className="btn" onClick={() => onClose?.(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>

      <style>{CSS}</style>
    </div>,
    document.body
  );
}

const CSS = `
.imodal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:50}
.imodal{width:min(620px,92vw);background:#18232F;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.25);overflow:hidden}
.imodal-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:3px solid #111A22}
.imodal-head h3{margin:0;font-size:18px}
.imodal-body{padding:14px 16px;display:grid;gap:12px}
.x{border:none;background:transparent;font-size:22px;line-height:1;cursor:pointer}
.f{display:flex;flex-direction:column;gap:6px}
.imodal .in{background:#111A22;color:#FFFFFF;border:1px solid #111A22;border-radius:10px;padding:10px 12px;width:100%}
.imodal .in.error{border-color:#ef4444}
.err{color:#dc2626;font-size:12px;margin-top:4px}
.imodal .row{display:flex;gap:8px;align-items:center}
.imodal .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.imodal .btn{padding:9px 14px;border:1px solid #334155;background:#111A22;color:#fff;border-radius:999px;cursor:pointer}
.imodal .btn:hover{background:#23313d}
.imodal .btn.primary{background:#138AEC;border-color:#138AEC;color:#fff}
.imodal .btn.primary:hover{background:#1e5fe6;}
.imodal .btn.ghost{background:#fff;color:black}
.imodal .chip{display:inline-flex;align-items:center;gap:8px;background:#111A22;color:#fff;border:none;border-radius:10px;padding:7px 12px}
.imodal .foot{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
@media (max-width:560px){ .grid2{grid-template-columns:1fr} }

/* ===== Blank page style for admin ===== */
.imodal.imodal-blank{width:min(540px,92vw); background:#fff;}
.imodal-blank-content{padding:24px 20px; text-align:center}
.imodal-blank-title{margin:0 0 8px 0; font-size:18px; font-weight:600}
.imodal-blank-msg{margin:0 0 16px 0; color:#6b7280}
`;