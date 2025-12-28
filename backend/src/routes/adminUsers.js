// backend/src/routes/adminUsers.js
const express = require('express');
const db = require('../db');
const router = express.Router();

// ปรับตาม enum ของคุณ (จากรูปเห็นอย่างน้อยพวกนี้)
const ALLOWED_ROLES = ['admin', 'manager', 'production', 'fleet', 'captain'];

function normalizeRole(role) {
  if (!role) return 'production';
  const r = String(role).toLowerCase();
  return ALLOWED_ROLES.includes(r) ? r : 'production';
}

// GET /api/admin/users?q=&role=&limit=
router.get('/', async (req, res) => {
  try {
    const { q, role, limit = 100 } = req.query;
    const where = [];
    const vals = [];

    if (q) {
      where.push('(username LIKE ? OR display_name LIKE ?)');
      vals.push(`%${q}%`, `%${q}%`);
    }
    if (role) {
      where.push('role = ?');
      vals.push(normalizeRole(role));
    }

    const sql = `
      SELECT id, username, display_name, role, created_at
      FROM users
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC
      LIMIT ${Math.min(Number(limit) || 100, 500)}
    `;
    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (err) {
    console.error('[adminUsers:list]', err);
    res.status(500).json({ message: 'failed to list users' });
  }
});

// POST /api/admin/users
router.post('/', async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'username & password required' });
    }

    const [dup] = await db.query('SELECT id FROM users WHERE username=? LIMIT 1', [username]);
    if (dup.length) {
      return res.status(409).json({ message: 'username already exists' });
    }

    const [r] = await db.query(
      `INSERT INTO users (username, password, display_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [username, password, display_name || username, normalizeRole(role)]
    );

    const [row] = await db.query(
      'SELECT id, username, display_name, role, created_at FROM users WHERE id=?',
      [r.insertId]
    );
    res.status(201).json(row[0]);
  } catch (err) {
    console.error('[adminUsers:create]', err);
    res.status(400).json({ message: err.message || 'create failed' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, display_name, role, password } = req.body || {};
    const sets = [];
    const vals = [];

    // อัปเดต username (ถ้าส่งมา) + ตรวจชื่อซ้ำ (ยกเว้น user เดิมเอง)
    if (username !== undefined) {
      const uname = String(username).trim();
      if (!uname) return res.status(400).json({ message: 'username required' });

      const [dup] = await db.query(
        'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
        [uname, id]
      );
      if (dup.length) {
        return res.status(409).json({ message: 'username already exists' });
      }

      sets.push('username=?'); vals.push(uname);
    }

    if (display_name !== undefined) {
      sets.push('display_name=?'); vals.push(display_name || '');
    }

    if (role !== undefined) {
      sets.push('role=?'); vals.push(normalizeRole(role));
    }

    if (password !== undefined && password !== '') {
      sets.push('password=?'); vals.push(password);
    }

    if (!sets.length) return res.json({ ok: true }); // ไม่มีอะไรให้แก้

    sets.push('updated_at=NOW()');
    vals.push(id);

    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, vals);

    const [row] = await db.query(
      'SELECT id, username, display_name, role, created_at FROM users WHERE id=?',
      [id]
    );
    res.json(row[0]);
  } catch (err) {
    console.error('[adminUsers:update]', err);
    res.status(400).json({ message: err.message || 'update failed' });
  }
});


// DELETE /api/admin/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user?.id === id) {
      return res.status(400).json({ message: "Can't delete yourself" });
    }
    await db.query('DELETE FROM users WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUsers:delete]', err);
    res.status(400).json({ message: err.message || 'delete failed' });
  }
});

module.exports = router;
