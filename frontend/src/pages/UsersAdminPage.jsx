// frontend/src/pages/UsersAdminPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../api/adminUsers';

// Keep this list in sync with your backend/DB enum
const ROLES = ['production', 'fleet', 'captain', 'manager', 'admin'];

function fmt(ts) {
  if (!ts) return '-';
  return String(ts).replace('T', ' ').slice(0, 19);
}

/* ==== Lightweight global toast (bottom-right, success style) ==== */
function ensureToast(message, duration = 2500) {
  if (typeof window !== 'undefined' && window.showGlobalToast) {
    window.showGlobalToast(message, duration);
    return;
  }
  let container = document.getElementById('itoast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'itoast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: '2147483647',
    });
    document.body.appendChild(container);
  }
  const item = document.createElement('div');
  Object.assign(item.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#16a34a',
    color: '#FFFFFF',
    border: '1px solid #16a34a',
    borderRadius: '12px',
    padding: '10px 12px',
    boxShadow: '0 10px 30px rgba(0,0,0,.25)',
    fontSize: '14px',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity .18s ease, transform .18s ease',
  });
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="white" fill-opacity="0.95"></circle>
      <path d="M6 10.2l2.2 2.2L14 6.9" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
  const text = document.createElement('span');
  text.textContent = message;
  item.appendChild(icon);
  item.appendChild(text);
  container.appendChild(item);
  requestAnimationFrame(() => {
    item.style.opacity = '1';
    item.style.transform = 'translateY(0)';
  });
  const timeout = setTimeout(() => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(6px)';
    item.addEventListener(
      'transitionend',
      () => {
        try {
          container.removeChild(item);
          if (!container.childElementCount) container.parentNode?.removeChild(container);
        } catch {}
      },
      { once: true }
    );
  }, duration);
  return () => clearTimeout(timeout);
}

export default function UsersAdminPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listUsers({ q, limit: 200 });
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [q]);

  const roleCounts = useMemo(() => {
    const c = { all: (rows || []).length };
    for (const r of ROLES) c[r] = 0;
    for (const u of rows || []) {
      if (u.role && (u.role in c)) c[u.role] += 1;
    }
    return c;
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (role === 'all') return rows;
    return (rows || []).filter(u => u.role === role);
  }, [rows, role]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">User Management</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Create User</button>
        </div>
      </div>

      <div className="card ">
        <div className="card-head flex items-center py-3" style={{ gap: '5px' }}>
          <input
            className="input"
            placeholder="Search username / display name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 200, maxWidth: 265 }}
          />
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ minWidth: 150, maxWidth: 180 }}
          >
            <option value="all">All roles ({roleCounts.all ?? 0})</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r} ({roleCounts[r] ?? 0})
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>Username</th>
                <th>Display name</th>
                <th style={{ width: 160 }}>Role</th>
                <th style={{ width: 190 }}>Created</th>
                <th style={{ width: 200 }} className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="muted">Loading…</td></tr>
              )}
              {!loading && !(visibleRows || []).length && (
                <tr><td colSpan={6} className="muted">No users</td></tr>
              )}
              {!loading && visibleRows.map((r) => (
                <tr key={r.id} className="hoverable">
                  <td>#{r.id}</td>
                  <td>{r.username}</td>
                  <td>{r.display_name || '-'}</td>
                  <td>{r.role}</td>
                  <td className="muted">{fmt(r.created_at)}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button className="btn btn-ghost" onClick={() => setEditRow(r)}>Edit</button>
                      <button
                        className="btn btn-ghost"
                        onClick={async () => {
                          if (!confirm(`Delete ${r.username}?`)) return;
                          await deleteUser(r.id);
                          load();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <UserModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            ensureToast('User created successfully.');
            load();
          }}
        />
      )}
      {editRow && (
        <UserModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            ensureToast('User updated successfully.');
            load();
          }}
        />
      )}
    </div>
  );
}

function UserModal({ row, onClose, onSaved }) {
  const [username, setUsername] = useState(row?.username || '');
  const [displayName, setDisplayName] = useState(row?.display_name || '');
  const [role, setRole] = useState(row?.role || 'production');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (row) {
        const nextUsername = username.trim();
        if (!nextUsername) {
          alert('username required');
          setBusy(false);
          return;
        }
        const payload = {
          username: nextUsername,
          display_name: (displayName || nextUsername).trim(),
          role,
        };
        if (password) payload.password = password;
        await updateUser(row.id, payload);
      } else {
        const nextUsername = username.trim();
        const nextPassword = password.trim();
        if (!nextUsername || !nextPassword) {
          alert('username & password required');
          setBusy(false);
          return;
        }
        await createUser({
          username: nextUsername,
          password: nextPassword,
          display_name: (displayName || nextUsername).trim(),
          role,
        });
      }
      onSaved?.();
    } catch (err) {
      alert(err?.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{row ? 'Edit user' : 'Create user'}</h3>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <div className="muted text-xs mb-1">Username</div>
              <input
                className="input w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">Display name</div>
              <input
                className="input w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">Role</div>
              <select
                className="select w-full"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="muted text-xs mb-1">{row ? 'New password (optional)' : 'Password'}</div>
              <input
                type="password"
                className="input w-full"
                placeholder={row ? 'Leave blank to keep current password' : ''}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!row}
                onInvalid={e => e.target.setCustomValidity("Please fill in all the information.")}
                onInput={e => e.target.setCustomValidity("")}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {row ? (busy ? 'Saving…' : 'Save') : (busy ? 'Adding…' : 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
