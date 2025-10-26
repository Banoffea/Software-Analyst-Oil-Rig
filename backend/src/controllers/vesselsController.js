const db = require('../db');

/* CRUD */
// รายการเรือ + ตำแหน่งล่าสุด
exports.list = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        v.id, v.vessel_no, v.name, v.capacity, v.status,
        vp.recorded_at AS last_recorded_at,
        vp.lat AS last_lat, vp.lon AS last_lon,
        vp.speed AS last_speed, vp.course AS last_course
      FROM vessels v
      LEFT JOIN (
        SELECT vp.*
        FROM vessel_positions vp
        JOIN (
          SELECT vessel_id, MAX(recorded_at) AS max_ts
          FROM vessel_positions GROUP BY vessel_id
        ) m ON m.vessel_id = vp.vessel_id AND m.max_ts = vp.recorded_at
      ) vp ON vp.vessel_id = v.id
      ORDER BY v.id
    `);

    const out = rows.map(r => ({
      id: r.id,
      vessel_no: r.vessel_no,
      name: r.name,
      capacity: r.capacity,
      status: r.status,
      last_position: r.last_recorded_at ? {
        recorded_at: r.last_recorded_at,
        lat: r.last_lat,
        lon: r.last_lon,
        speed: r.last_speed,
        course: r.last_course,
      } : null,
    }));

    res.json(out);
  } catch (e) {
    console.error('[vessels.list] error', e);
    res.status(500).json({ message: 'DB error' });
  }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vessels WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: 'DB error' }); }
};
exports.create = async (req, res) => {
  try {
    const { vessel_no, name, capacity, status } = req.body;
    const [r] = await db.query(
      'INSERT INTO vessels (vessel_no, name, capacity, status) VALUES (?, ?, ?, ?)',
      [vessel_no, name ?? null, capacity ?? null, status ?? 'idle']
    );
    res.json({ id: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ message: 'DB error' }); }
};
exports.update = async (req, res) => {
  try {
    const { vessel_no, name, capacity, status } = req.body;
    await db.query(
      `UPDATE vessels
       SET vessel_no = COALESCE(?, vessel_no),
           name      = COALESCE(?, name),
           capacity  = COALESCE(?, capacity),
           status    = COALESCE(?, status)
       WHERE id = ?`,
      [vessel_no, name, capacity, status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: 'DB error' }); }
};

/* Realtime position & track */
exports.updatePosition = async (req, res) => {
  const id = req.params.id;
  const { lat, lon, speed, course, recorded_at } = req.body;
  if (lat == null || lon == null) return res.status(400).json({ message: 'lat/lon required' });

  try {
    await db.query(
      `INSERT INTO vessel_positions (vessel_id, recorded_at, lat, lon, speed, course)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, recorded_at ?? new Date(), lat, lon, speed ?? null, course ?? null]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: 'DB error' }); }
};

exports.latestPositions = async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT vp.*
       FROM vessel_positions vp
       JOIN (SELECT vessel_id, MAX(recorded_at) last_ts
             FROM vessel_positions GROUP BY vessel_id) t
         ON t.vessel_id = vp.vessel_id AND t.last_ts = vp.recorded_at
       ORDER BY vp.vessel_id`
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ message: 'DB error' }); }
};

exports.track = async (req, res) => {
  const id = req.params.id;
  const { from, to, limit } = req.query;

  const where = ['vessel_id = ?']; const vals = [id];
  if (from) { where.push('recorded_at >= ?'); vals.push(new Date(from)); }
  if (to)   { where.push('recorded_at <= ?'); vals.push(new Date(to)); }
  const lim = Math.min(parseInt(limit || '1000', 10), 5000);

  try {
    const [rows] = await db.query(
      `SELECT id, vessel_id, recorded_at, lat, lon, speed, course
       FROM vessel_positions
       WHERE ${where.join(' AND ')}
       ORDER BY recorded_at ASC
       LIMIT ${lim}`,
      vals
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ message: 'DB error' }); }
};

// --- ตัดมาเฉพาะส่วนใหม่ ---
exports.addPosition = async (req, res) => {
  const { vessel_id, recorded_at, lat, lon, speed, course } = req.body || {};
  if (!vessel_id || !recorded_at || lat == null || lon == null)
    return res.status(400).json({ message: 'vessel_id, recorded_at, lat, lon required' });

  const db = require('../db');
  await db.query(
    `INSERT INTO vessel_positions (vessel_id, recorded_at, lat, lon, speed, course)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [vessel_id, recorded_at, lat, lon, speed ?? null, course ?? null]
  );
  res.json({ ok: true });
};

exports.addPositionsBulk = async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : [];
  if (!rows.length) return res.status(400).json({ message: 'array required' });
  const values = rows.map(r => [
    r.vessel_id, r.recorded_at, r.lat, r.lon, r.speed ?? null, r.course ?? null
  ]);
  const db = require('../db');
  await db.query(
    `INSERT INTO vessel_positions (vessel_id, recorded_at, lat, lon, speed, course) VALUES ?`,
    [values]
  );
  res.json({ inserted: values.length });
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'invalid id' });

    // ✅ admin only
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'admin only' });
    }

    const [[exists]] = await db.query('SELECT * FROM vessels WHERE id=?', [id]);
    if (!exists) return res.status(404).json({ message: 'not found' });

    // ✅ อนุญาตแก้เฉพาะ name, vessel_no, capacity (ไม่แก้ status)
    const allowed = ['name', 'vessel_no', 'capacity'];
    const sets = [], vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k}=?`);
        // แปลงค่าว่างให้เป็น null
        const val = req.body[k] === '' ? null : req.body[k];
        vals.push(val);
      }
    }
    if (!sets.length) return res.status(400).json({ message: 'nothing to update' });

    vals.push(id);
    await db.query(`UPDATE vessels SET ${sets.join(', ')} WHERE id=?`, vals);

    const [[row]] = await db.query('SELECT * FROM vessels WHERE id=?', [id]);
    res.json(row);
  } catch (e) {
    console.error('[vessels] update error:', e);
    res.status(500).json({ message: 'failed to update vessel' });
  }
};
