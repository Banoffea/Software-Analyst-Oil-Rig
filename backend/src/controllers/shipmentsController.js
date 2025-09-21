const db = require('../db');

exports.create = async (req, res) => {
  const db = require('../db');
  const { vessel_id, origin_rig_id, destination, etd, eta } = req.body;
  const [r] = await db.query(
    `INSERT INTO shipments (vessel_id, origin_rig_id, destination, etd, eta)
     VALUES (?, ?, ?, ?, ?)`,
    [vessel_id, origin_rig_id, destination ?? null, etd ?? null, eta ?? null]
  );
  res.json({ shipment_id: r.insertId });
};

exports.addItems = async (req, res) => {
  const db = require('../db');
  const shipmentId = req.params.id;
  const items = Array.isArray(req.body) ? req.body : [];
  if (!items.length) return res.status(400).json({ message: 'items required' });

  const values = items.map(i => [shipmentId, i.lot_id, i.quantity ?? null]);
  await db.query(`INSERT INTO shipment_items (shipment_id, lot_id, quantity) VALUES ?`, [values]);
  res.json({ added: items.length });
};

exports.depart = async (req, res) => {
  const db = require('../db');
  const id = req.params.id;
  await db.query(`UPDATE shipments SET status='departed', depart_at=NOW() WHERE id=?`, [id]);
  await db.query(
    `UPDATE product_lots l
     JOIN shipment_items si ON si.lot_id = l.id
     SET l.status = 'in_transit'
     WHERE si.shipment_id = ?`,
    [id]
  );
  res.json({ ok: true });
};

exports.arrive = async (req, res) => {
  const db = require('../db');
  const id = req.params.id;
  await db.query(`UPDATE shipments SET status='arrived', arrive_at=NOW() WHERE id=?`, [id]);
  await db.query(
    `UPDATE product_lots l
     JOIN shipment_items si ON si.lot_id = l.id
     SET l.status = 'delivered'
     WHERE si.shipment_id = ?`,
    [id]
  );
  res.json({ ok: true });
};

// GET /api/shipments?vessel_id=&rig_id=&status=&q=&limit=
exports.list = async (req, res) => {
  try {
    const { vessel_id, rig_id, status, q, limit = 50 } = req.query;

    const where = [];
    const vals = [];
    if (vessel_id) { where.push('vessel_id = ?'); vals.push(vessel_id); }
    if (rig_id)    { where.push('origin_rig_id = ?'); vals.push(rig_id); }
    if (status)    { where.push('status = ?'); vals.push(status); }
    if (q) {
      where.push('(CAST(id AS CHAR) LIKE ? OR CAST(vessel_id AS CHAR) LIKE ?)');
      vals.push(`%${q}%`, `%${q}%`);
    }

    // ⬅️ เพิ่ม destination ใน SELECT
    const sql = `
      SELECT id, vessel_id, origin_rig_id, destination,
             depart_at, arrive_at, status, created_at
      FROM shipments
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY COALESCE(depart_at, arrive_at, created_at) DESC
      LIMIT ?
    `;
    vals.push(Math.min(Number(limit) || 50, 200));

    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (e) {
    console.error('[shipments] list error:', e);
    res.status(500).json({ message: 'failed to list shipments' });
  }
};


exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, vessel_id, origin_rig_id, destination,
              depart_at, arrive_at, status, created_at
       FROM shipments WHERE id=? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[shipments] getOne error:', e);
    res.status(500).json({ message: 'failed to get shipment' });
  }
};
