// backend/src/controllers/rigsController.js
const db = require('../db');

const STATUSES = new Set(['online', 'offline', 'maintenance']);

function normStatus(s) {
  if (s === undefined || s === null) return s;
  return String(s).toLowerCase();
}
function isAdmin(req)      { return req.user?.role === 'admin'; }
function isProduction(req) { return req.user?.role === 'production'; }

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
      const st = normStatus(status);
      where.push('status=?');
      vals.push(st);
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
    if (!isAdmin(req)) return res.status(403).json({ message: 'admin only' });

    const {
      rig_code, name,
      location = null, lat = null, lon = null, capacity = null,
      status = 'online',
    } = req.body || {};

    if (!rig_code || !name) {
      return res.status(400).json({ message: 'rig_code and name required' });
    }

    const st = normStatus(status);
    if (!STATUSES.has(st)) return res.status(400).json({ message: 'invalid status' });

    const [dup] = await db.query('SELECT id FROM oil_rigs WHERE rig_code=? LIMIT 1', [rig_code]);
    if (dup.length) return res.status(409).json({ message: 'rig_code already exists' });

    const [r] = await db.query(
      `INSERT INTO oil_rigs
         (rig_code, name, location, lat, lon, capacity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [rig_code, name, location, lat, lon, capacity, st]
    );
    const [[row]] = await db.query('SELECT * FROM oil_rigs WHERE id=?', [r.insertId]);
    res.status(201).json(row);
  } catch (e) {
    console.error('[rigs] create error:', e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'rig_code already exists' });
    res.status(500).json({ message: 'failed to create rig' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'invalid id' });

    const [[exists]] = await db.query('SELECT * FROM oil_rigs WHERE id=?', [id]);
    if (!exists) return res.status(404).json({ message: 'not found' });

    const role = req.user?.role;

    // ถ้าเป็น production: อนุญาตแก้เฉพาะ status
    if (role === 'production') {
      const keys = Object.keys(req.body || {});
      if (!(keys.length === 1 && keys[0] === 'status')) {
        return res.status(403).json({ message: 'production can update status only' });
      }
      const st = normStatus(req.body.status);
      if (!STATUSES.has(st)) return res.status(400).json({ message: 'invalid status' });

      await db.query('UPDATE oil_rigs SET status=? WHERE id=?', [st, id]);
      const [[row]] = await db.query('SELECT * FROM oil_rigs WHERE id=?', [id]);
      return res.json(row);
    }

    // manager/admin: อนุญาตทุกฟิลด์ที่ allow
    if (role === 'admin' || role === 'manager') {
      const allowed = ['rig_code','name','location','lat','lon','capacity','status'];
      const sets = [], vals = [];
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === 'status') {
            const st = normStatus(req.body[k]);
            if (!STATUSES.has(st)) return res.status(400).json({ message: 'invalid status' });
            sets.push('status=?'); vals.push(st);
          } else {
            sets.push(`${k}=?`); vals.push(req.body[k]);
          }
        }
      }
      if (!sets.length) return res.status(400).json({ message: 'nothing to update' });

      vals.push(id);
      await db.query(`UPDATE oil_rigs SET ${sets.join(', ')} WHERE id=?`, vals);
      const [[row]] = await db.query('SELECT * FROM oil_rigs WHERE id=?', [id]);
      return res.json(row);
    }

    // มาถึงนี่คือ role อื่น/ไม่มี user -> forbid
    return res.status(403).json({ message: 'forbidden' });
  } catch (e) {
    console.error('[rigs] update error:', e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'rig_code already exists' });
    res.status(500).json({ message: 'failed to update rig' });
  }
};


exports.remove = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: 'admin only' });
    const id = Number(req.params.id);
    await db.query('DELETE FROM oil_rigs WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[rigs] delete error:', e);
    res.status(500).json({ message: 'failed to delete rig' });
  }
};
