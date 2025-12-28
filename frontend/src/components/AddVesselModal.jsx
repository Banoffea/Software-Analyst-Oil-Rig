// src/components/AddVesselModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createVessel } from '../api/vessels';

/* ==== Lightweight global toast (bottom-right, success style) ==== */
function ensureToast(message, duration = 2500) {
  // ใช้ตัวเดียวกับหน้าอื่นได้: ถ้ามีอยู่แล้วก็ใช้ต่อ
  if (typeof window !== 'undefined' && window.showGlobalToast) {
    window.showGlobalToast(message, duration);
    return;
  }
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

export default function AddVesselModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [vesselNo, setVesselNo] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  const firstRef  = useRef(null);
  const vesselRef = useRef(null);
  const capRef    = useRef(null);

  // keep latest onClose for ESC
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // reset ONLY when open becomes true
  useEffect(() => {
    if (!open) return;

    setName('');
    setVesselNo('');
    setCapacity('');

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => firstRef.current?.focus(), 30);

    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  if (!open) return null;

  const req = (v) => String(v).trim().length > 0;
  const isPositiveInt = (v) => {
    if (v === '' || v == null) return false;
    const n = Number(v);
    return Number.isFinite(n) && Number.isInteger(n) && n > 0;
  };

  const onCapKeydown = (e) => {
    if (['e','E','+','-','.'].includes(e.key)) e.preventDefault();
  };

  const submit = async (e) => {
    e.preventDefault();

    // HTML5 required bubbles for empty fields
    if (!req(name) || !req(vesselNo) || !req(capacity)) {
      if (!req(name)) firstRef.current?.reportValidity?.();
      else if (!req(vesselNo)) vesselRef.current?.reportValidity?.();
      else capRef.current?.reportValidity?.();
      return;
    }

    // extra check for positive integer (browser bubble)
    if (!isPositiveInt(capacity)) {
      if (capRef.current) {
        capRef.current.setCustomValidity('Capacity must be a positive integer');
        capRef.current.reportValidity();
        setTimeout(() => capRef.current?.setCustomValidity(''), 0);
      }
      return;
    }

    try {
      setBusy(true);
      await createVessel({
        name: String(name).trim(),
        vessel_no: String(vesselNo).trim(),
        capacity: Number(capacity),
        status: 'idle',
      });

      // ✅ Toast แจ้งเตือนสำเร็จ
      ensureToast('Vessel created successfully.');

      onCreated?.();
      onClose?.();
    } catch (err) {
      const r   = err?.response;
      const b   = r?.data || {};
      const raw = [
        b.message,
        b.error,
        Array.isArray(b.errors) && b.errors[0]?.message,
        err?.message,
      ].filter(Boolean).join(' | ');

      // ครอบคลุมเคสซ้ำยอดนิยม
      // - HTTP 409
      // - MySQL: Duplicate entry (errno 1062)
      // - Postgres: unique_violation (23505)
      // - SQL Server: 2627/2601
      // - SQLite: UNIQUE constraint failed
      // - หรือ backend ตอบ "DB error" แต่ความจริงเป็น unique duplicate → บังคับแปลข้อความให้ผู้ใช้เข้าใจ
      const isDup =
        r?.status === 409 ||
        /duplicate|already\s*exist|unique|duplicate entry|UNIQUE constraint|23505|1062|2627|2601/i.test(raw) ||
        /db\s*error/i.test(raw);

      if (isDup) {
        window.alert('Vessel No already exists');
        vesselRef.current?.focus();
        return;
      }

      window.alert(raw || 'Create vessel failed');
    } finally {
      setBusy(false);
    }
  };

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <div className="modal-backdrop" onMouseDown={onBackdrop}>
      <form className="modal" onSubmit={submit} onMouseDown={(e)=>e.stopPropagation()}>
        <h3 className="modal-title">Add vessel</h3>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <label className="block">
            <div className="muted text-xs mb-1">Vessel No</div>
            <input
              ref={vesselRef}
              id="avm-vessel-no"
              className="input w-full"
              placeholder="e.g. V11"
              value={vesselNo}
              onChange={(e)=>setVesselNo(e.target.value)}
              required
              onInvalid={e => e.target.setCustomValidity('Please fill in all the information.')}
              onInput={e => e.target.setCustomValidity('')}
            />
          </label>

          <label className="block">
            <div className="muted text-xs mb-1">Vessel name</div>
            <input
              ref={firstRef}
              id="avm-name"
              className="input w-full"
              placeholder="e.g. Poseidon"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              required
              onInvalid={e => e.target.setCustomValidity('Please fill in all the information.')}
              onInput={e => e.target.setCustomValidity('')}
            />
          </label>

          <label className="block">
            <div className="muted text-xs mb-1">Capacity (bbl)</div>
            <input
              ref={capRef}
              id="avm-capacity"
              className="input w-full"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              max="1000000"
              placeholder="e.g. 25000 bbl (Max 1000000)"
              value={capacity}
              onChange={(e)=>setCapacity(e.target.value)}
              onKeyDown={onCapKeydown}
              required
              onInvalid={e => e.target.setCustomValidity('Please fill in all the information correctly.')}
              onInput={e => e.target.setCustomValidity('')}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}
