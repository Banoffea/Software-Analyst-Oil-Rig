const jwt = require('jsonwebtoken');
const db  = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// ============ AUTH ============
exports.loginWithRoles = (allowedRoles = []) => async (req, res) => {
  try {
    const { username = '', password = '' } = req.body || {};
    const [[u]] = await db.query(
      'SELECT id, username, password, role FROM users WHERE username=? LIMIT 1',
      [username.trim()]
    );
    if (!u || String(u.password) !== String(password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // เช็ค role ที่อนุญาต
    if (allowedRoles.length && !allowedRoles.includes(u.role)) {
      return res.status(403).json({ message: 'Forbidden: role not allowed' });
    }

    const token = jwt.sign(
      { uid: u.id, username: u.username, role: u.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // ใส่ role กลับไปด้วย เผื่อ FE อยากใช้
    res.json({ token, role: u.role, user: { id: u.id, username: u.username, role: u.role } });
  } catch (e) {
    console.error('[sim] login error', e);
    res.status(500).json({ message: 'login failed' });
  }
};
exports.login = exports.loginWithRoles(['admin', 'captain']);


// ============ MASTER DATA ============
exports.listVessels = async (_req, res) => {
  const [rows] = await db.query('SELECT id, name, vessel_no, status FROM vessels ORDER BY id');
  res.json(rows);
};

exports.listRigs = async (_req, res) => {
  const [rows] = await db.query(
    'SELECT id, rig_code, name, lat, lon FROM oil_rigs ORDER BY id'
  );
  res.json(rows);
};

exports.listLotsByRig = async (req, res) => {
  const rig_id = Number(req.query.rig_id || 0);
  if (!rig_id) return res.json([]);
  const [rows] = await db.query(
    `SELECT id, lot_date, total_qty, status
     FROM product_lots
     WHERE rig_id=? AND status='on_rig'
     ORDER BY lot_date DESC, id DESC`,
    [rig_id]
  );
  res.json(rows);
};

// ============ VESSEL STATUS ============
exports.updateVesselStatus = async (req, res) => {
  const id = Number(req.params.id || 0);
  const { status } = req.body || {};
  if (!id || !status) return res.status(400).json({ message: 'invalid' });
  await db.query('UPDATE vessels SET status=? WHERE id=?', [status, id]);
  res.json({ ok: true });
};

// ============ VOYAGES ============
async function getActiveShipment(vessel_id) {
  const [[s]] = await db.query(
    `SELECT id, vessel_id, origin_rig_id, destination, status
     FROM shipments
     WHERE vessel_id=? AND status!='arrived'
     ORDER BY id DESC LIMIT 1`,
    [vessel_id]
  );
  if (!s) return null;

  const [its] = await db.query(
    `SELECT si.lot_id, l.lot_date, l.total_qty
     FROM shipment_items si
     JOIN product_lots l ON l.id=si.lot_id
     WHERE si.shipment_id=? ORDER BY si.lot_id`,
    [s.id]
  );
  return { ...s, lot_ids: its.map(x => x.lot_id), lots: its };
}

exports.getActiveVoyage = async (req, res) => {
  const vessel_id = Number(req.query.vessel_id || 0);
  if (!vessel_id) return res.json({});
  const active = await getActiveShipment(vessel_id);
  res.json(active || {});
};

exports.startVoyage = async (req, res) => {
  const { vessel_id, origin_rig_id, destination, lot_ids = [] } = req.body || {};
  if (!vessel_id || !origin_rig_id || !destination || !Array.isArray(lot_ids) || lot_ids.length === 0) {
    return res.status(400).json({ message: 'vessel_id, origin_rig_id, destination, lot_ids required' });
  }

  // 1) block if this vessel already has active voyage
  const active = await getActiveShipment(vessel_id);
  if (active) {
    return res.status(409).json({ message: 'Voyage already active for this vessel', active });
  }

  // 2) validate lots: must belong to origin rig and status=on_rig
  const [okLots] = await db.query(
    `SELECT id FROM product_lots WHERE id IN (?) AND rig_id=? AND status='on_rig'`,
    [lot_ids, origin_rig_id]
  );
  if (okLots.length !== lot_ids.length) {
    const okSet = new Set(okLots.map(x => x.id));
    const bad = lot_ids.filter(x => !okSet.has(x));
    return res.status(409).json({ message: 'Some lots are not available', invalid_lot_ids: bad });
  }

  // 3) create shipment + items, update statuses (transaction-like)
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO shipments (vessel_id, origin_rig_id, destination, depart_at, status, created_at)
       VALUES (?, ?, ?, NOW(), 'departed', NOW())`,
      [vessel_id, origin_rig_id, destination]
    );
    const shipment_id = ins.insertId;

    if (lot_ids.length) {
      const values = lot_ids.map(id => [shipment_id, id]);
      await conn.query(`INSERT INTO shipment_items (shipment_id, lot_id) VALUES ?`, [values]);
      await conn.query(`UPDATE product_lots SET status='in_transit' WHERE id IN (?)`, [lot_ids]);
    }

    await conn.query(`UPDATE vessels SET status='sailing' WHERE id=?`, [vessel_id]);

    await conn.commit();
    res.status(201).json({ shipment_id });
  } catch (e) {
    await conn.rollback();
    console.error('[sim] startVoyage error', e);
    res.status(500).json({ message: 'start failed' });
  } finally {
    conn.release();
  }
};

exports.arriveVoyage = async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: 'id required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // lots in this shipment
    const [its] = await conn.query(`SELECT lot_id FROM shipment_items WHERE shipment_id=?`, [id]);
    const lotIds = its.map(x => x.lot_id);

    await conn.query(`UPDATE shipments SET arrive_at=NOW(), status='arrived' WHERE id=?`, [id]);
    if (lotIds.length) {
      await conn.query(`UPDATE product_lots SET status='delivered' WHERE id IN (?)`, [lotIds]);
    }

    // set vessel idle
    const [[sp]] = await conn.query(`SELECT vessel_id FROM shipments WHERE id=?`, [id]);
    if (sp?.vessel_id) {
      await conn.query(`UPDATE vessels SET status='idle' WHERE id=?`, [sp.vessel_id]);
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('[sim] arrive error', e);
    res.status(500).json({ message: 'arrive failed' });
  } finally {
    conn.release();
  }
};

// ============ POSITIONS ============
exports.postPosition = async (req, res) => {
  const { vessel_id, lat, lon, speed = null, course = null } = req.body || {};
  if (!vessel_id || lat == null || lon == null) {
    return res.status(400).json({ message: 'vessel_id, lat, lon required' });
  }
  const [ins] = await db.query(
    `INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, recorded_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [vessel_id, lat, lon, speed, course]
  );
  const [[row]] = await db.query(`SELECT * FROM vessel_positions WHERE id=?`, [ins.insertId]);
  res.status(201).json(row);
};

