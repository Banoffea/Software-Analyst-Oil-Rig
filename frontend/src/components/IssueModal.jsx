import React, { useState, useEffect } from 'react';
import { createIssue } from '../api/issues';

/**
 props:
  - open: boolean
  - onClose: () => void
  - onCreated: (issue) => void
  - defaultType: 'oil'|'vessel' (optional)
  - refOptions: [{ id, label }] (optional) - ให้เลือก ref_id
*/
export default function IssueModal({ open, onClose, onCreated, defaultType = 'oil', refOptions = [] }) {
  const [issueType, setIssueType] = useState(defaultType);
  const [refId, setRefId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setIssueType(defaultType);
      setRefId('');
      setTitle('');
      setDescription('');
      setError('');
    }
  }, [open, defaultType]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('กรุณากรอกหัวข้อ');
    setLoading(true);
    try {
      const payload = {
        issue_type: issueType,
        ref_id: refId || null,
        title,
        description
      };
      const res = await createIssue(payload);
      setLoading(false);
      onCreated && onCreated(res);
      onClose && onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || 'ไม่สามารถสร้าง issue ได้');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>แจ้งปัญหา</h3>
        <form onSubmit={submit}>
          <label>ประเภท</label>
          <select value={issueType} onChange={e => setIssueType(e.target.value)}>
            <option value="oil">Oil</option>
            <option value="vessel">Vessel</option>
          </select>

          <label>อ้างอิง (ถ้ามี)</label>
          {refOptions.length > 0 ? (
            <select value={refId} onChange={e => setRefId(e.target.value)}>
              <option value="">-- เลือก (optional) --</option>
              {refOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          ) : (
            <input placeholder="ref id (optional)" value={refId} onChange={e => setRefId(e.target.value)} />
          )}

          <label>หัวข้อ</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น ความเร็วผิดปกติของเรือ No.11" />

          <label>รายละเอียด</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose}>ยกเลิก</button>
            <button type="submit" disabled={loading}>{loading ? 'กำลังส่ง...' : 'ส่งรายงาน'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
