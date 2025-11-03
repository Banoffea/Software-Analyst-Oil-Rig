// src/components/AddVesselModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createVessel } from '../api/vessels';

export default function AddVesselModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [vesselNo, setVesselNo] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  const firstRef = useRef(null);
  const capRef = useRef(null);

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
      // let browser show which field is missing
      if (!req(name)) firstRef.current?.reportValidity?.();
      else if (!req(vesselNo)) e.currentTarget.querySelector('#avm-vessel-no')?.reportValidity?.();
      else capRef.current?.reportValidity?.();
      return;
    }

    // extra check for positive integer (show as browser bubble)
    if (!isPositiveInt(capacity)) {
      if (capRef.current) {
        capRef.current.setCustomValidity('Capacity must be a positive integer');
        capRef.current.reportValidity();
        // clear after showing bubble, so next input can revalidate
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
      onCreated?.();
      onClose?.();
    } catch (err) {
      // API error—surface as a browser bubble on capacity (still no inline text)
      const msg = err?.response?.data?.message || 'Create vessel failed';
      if (capRef.current) {
        capRef.current.setCustomValidity(msg);
        capRef.current.reportValidity();
        setTimeout(() => capRef.current?.setCustomValidity(''), 0);
      }
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
