// frontend/src/pages/UsersAdminPage.jsx
import React, { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../api/adminUsers';

// Keep this list in sync with your backend/DB enum
const ROLES = ['production', 'fleet', 'captain', 'manager', 'admin'];

function fmt(ts) {
  if (!ts) return '-';
  return String(ts).replace('T', ' ').slice(0, 19);
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
      const data = await listUsers({
        q,
        role: role === 'all' ? undefined : role,
        limit: 200,
      });
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [q, role]);

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
            style={{ minWidth: 120, maxWidth: 150 }}
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
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
              {!loading && !rows.length && (
                <tr><td colSpan={6} className="muted">No users</td></tr>
              )}
              {!loading && rows.map((r) => (
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
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {editRow && (
        <UserModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); load(); }}
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
