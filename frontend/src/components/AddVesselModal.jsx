// src/components/AddVesselModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createVessel } from '../api/vessels';

export default function AddVesselModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [vesselNo, setVesselNo] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setVesselNo('');
    setCapacity('');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => firstRef.current?.focus(), 0);
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();

    const payload = {
      name: name.trim(),
      vessel_no: vesselNo.trim(),
      capacity: Number(capacity),
      status: 'idle',                 // always idle by default
    };

    // require all fields
    if (!payload.name || !payload.vessel_no || !capacity) {
      alert('Please fill in all fields.');
      return;
    }
    if (Number.isNaN(payload.capacity) || payload.capacity <= 0) {
      alert('Capacity must be a positive number.');
      return;
    }

    try {
      setSaving(true);
      await createVessel(payload);
      setSaving(false);
      onClose?.();
      onCreated?.();                  // refresh list
    } catch (err) {
      setSaving(false);
      alert(err?.response?.data?.message || 'Create vessel failed');
    }
  };

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <div className="modal-backdrop" onMouseDown={onBackdrop}>
      <div className="modal" onMouseDown={(e)=>e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 className="modal-title">Add vessel</h3>

        <form onSubmit={submit} className="space-y-3">
          <label className="field">
            <span>Name</span>
            <input
              ref={firstRef}
              className="input"
              value={name}
              onChange={e=>setName(e.target.value)}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Vessel No</span>
              <input
                className="input"
                value={vesselNo}
                onChange={e=>setVesselNo(e.target.value)}
                placeholder="e.g. V11"
                required
              />
            </label>
            <label className="field">
              <span>Capacity (bbl)</span>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={capacity}
                onChange={e=>setCapacity(e.target.value)}
                placeholder="e.g. 15000"
                required
              />
            </label>
          </div>

          {/* Status field removed; default is idle */}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={()=>onClose?.()} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
