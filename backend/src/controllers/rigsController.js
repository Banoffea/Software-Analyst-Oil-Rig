// backend/src/controllers/rigsController.js
const db = require('../db');

const STATUSES = new Set(['online', 'offline', 'maintenance']);

exports.list = async (req, res) => {
  try {
    const { q, status, limit = 200 } = req.query;
    const where = [];
    const vals = [];
    if (q) {
      where.push('(rig_code LIKE ? OR name LIKE ? OR location LIKE ?)');
      vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      where.push('status=?');
      vals.push(status);
    }
    const sql = `
      SELECT id, rig_code, name, location, lat, lon, capacity, status, created_at
      FROM oil_rigs
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC
      LIMIT ${Math.min(Number(limit)||200, 500)}
    `;
    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (e) {
    console.error('[rigs] list error:', e);
    res.status(500).json({ message: 'failed to list rigs' });
  }
};

exports.create = async (req, res) => {
  try {
    const { rig_code, name, location=null, lat=null, lon=null, capacity=null, status='online' } = req.body || {};
    if (!rig_code || !name) return res.status(400).json({ message: 'rig_code and name required' });
    if (!STATUSES.has(status)) return res.status(400).json({ message: 'invalid status' });

    const [r] = await db.query(
      `INSERT INTO oil_rigs (rig_code, name, location, lat, lon, capacity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [rig_code, name, location, lat, lon, capacity, status]
    );
    const [[row]] = await db.query('SELECT * FROM oil_rigs WHERE id=?', [r.insertId]);
    res.status(201).json(row);
  } catch (e) {
    console.error('[rigs] create error:', e);
    // duplicate rig_code -> 1062
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'rig_code already exists' });
    res.status(500).json({ message: 'failed to create rig' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const allowed = ['rig_code','name','location','lat','lon','capacity','status'];
    const sets = [], vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if (k === 'status' && !STATUSES.has(req.body[k])) {
          return res.status(400).json({ message: 'invalid status' });
        }
        sets.push(`${k}=?`); vals.push(req.body[k]);
      }
    }
    if (!sets.length) return res.status(400).json({ message: 'nothing to update' });

    vals.push(id);
    await db.query(`UPDATE oil_rigs SET ${sets.join(', ')} WHERE id=?`, vals);
    const [[row]] = await db.query('SELECT * FROM oil_rigs WHERE id=?', [id]);
    res.json(row);
  } catch (e) {
    console.error('[rigs] update error:', e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'rig_code already exists' });
    res.status(500).json({ message: 'failed to update rig' });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('DELETE FROM oil_rigs WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[rigs] delete error:', e);
    res.status(500).json({ message: 'failed to delete rig' });
  }
};
