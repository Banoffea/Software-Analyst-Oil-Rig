// backend/src/controllers/issuesController.js
const db = require('../db');

const VALID_STATUSES = [
  'open',
  'in_progress',
  'waiting_approval',
  'need_rework',
  'approved',
];

// === Helpers: Thai time → MySQL string ===
const mysqlDateTimeBKK = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (t) => parts.find(p => p.type === t)?.value.padStart(2,'0');
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
};

// Normalize 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD HH:mm[:ss]' into 'YYYY-MM-DD HH:mm:ss'
const normalizeObservedAt = (s) => {
  if (!s) return null;
  const t = String(s).trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t)) return t + ':00';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return null;
};

// configurable window (seconds) to consider a reading/position "near" the chosen time
const WINDOW_SEC = Number(process.env.ISSUE_READING_WINDOW_SEC || 1800); // 30 minutes

// ---- nearest helpers (use indexed queries: <= ts and >= ts) ----
async function findNearestReadingAt(rigId, ts /* 'YYYY-MM-DD HH:mm:ss' */) {
  const [beforeRows] = await db.query(
    `SELECT id, lot_id, recorded_at
     FROM product_readings
     WHERE rig_id=? AND recorded_at <= ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [rigId, ts]
  );
  const [afterRows] = await db.query(
    `SELECT id, lot_id, recorded_at
     FROM product_readings
     WHERE rig_id=? AND recorded_at >= ?
     ORDER BY recorded_at ASC LIMIT 1`,
    [rigId, ts]
  );

  const b = beforeRows[0] || null;
  const a = afterRows[0] || null;

  if (!b && !a) return null;
  if (b && !a)  return withinWindow(b.recorded_at, ts) ? b : null;
  if (a && !b)  return withinWindow(a.recorded_at, ts) ? a : null;

  // both exist: pick closer
  const diffB = Math.abs((new Date(b.recorded_at) - new Date(ts)) / 1000);
  const diffA = Math.abs((new Date(a.recorded_at) - new Date(ts)) / 1000);
  const best = diffB <= diffA ? b : a;
  return Math.min(diffA, diffB) <= WINDOW_SEC ? best : null;
}

async function findNearestVesselPosAt(vesselId, ts) {
  const [beforeRows] = await db.query(
    `SELECT id, recorded_at
     FROM vessel_positions
     WHERE vessel_id=? AND recorded_at <= ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [vesselId, ts]
  );
  const [afterRows] = await db.query(
    `SELECT id, recorded_at
     FROM vessel_positions
     WHERE vessel_id=? AND recorded_at >= ?
     ORDER BY recorded_at ASC LIMIT 1`,
    [vesselId, ts]
  );

  const b = beforeRows[0] || null;
  const a = afterRows[0] || null;

  if (!b && !a) return null;
  if (b && !a)  return withinWindow(b.recorded_at, ts) ? b : null;
  if (a && !b)  return withinWindow(a.recorded_at, ts) ? a : null;

  const diffB = Math.abs((new Date(b.recorded_at) - new Date(ts)) / 1000);
  const diffA = Math.abs((new Date(a.recorded_at) - new Date(ts)) / 1000);
  const best = diffB <= diffA ? b : a;
  return Math.min(diffA, diffB) <= WINDOW_SEC ? best : null;
}

function withinWindow(recordedAt, ts) {
  return Math.abs((new Date(recordedAt) - new Date(ts)) / 1000) <= WINDOW_SEC;
}

// --- shipment helpers ---
async function getShipmentById(id) {
  const [rows] = await db.query(
    `SELECT id, vessel_id, origin_rig_id, destination, depart_at, arrive_at, status
     FROM shipments WHERE id=? LIMIT 1`, [id]
  );
  return rows[0] || null;
}

// หา shipment ที่ครอบคลุมเวลานั้น (อยู่ระหว่าง depart_at..arrive_at)
async function findShipmentCovering(vesselId, ts) {
  const [rows] = await db.query(
    `SELECT id, vessel_id, origin_rig_id, destination, depart_at, arrive_at, status
     FROM shipments
     WHERE vessel_id=?
       AND (depart_at IS NULL OR depart_at <= ?)
       AND (arrive_at IS NULL OR ? <= arrive_at)
     ORDER BY COALESCE(arrive_at, '9999-12-31 23:59:59') DESC,
              COALESCE(depart_at, '0000-01-01 00:00:00') DESC
     LIMIT 1`,
    [vesselId, ts, ts]
  );
  return rows[0] || null;
}

// =============== List ===============
exports.list = async (req, res) => {
  const { type, rig_id, vessel_id, lot_id, shipment_id, status, severity, from, to, q, limit = 100 } = req.query;

  const where = [];
  const vals = [];

  if (type)         { where.push('type=?'); vals.push(type); }
  if (rig_id)       { where.push('rig_id=?'); vals.push(rig_id); }
  if (vessel_id)    { where.push('vessel_id=?'); vals.push(vessel_id); }
  if (lot_id)       { where.push('lot_id=?'); vals.push(lot_id); }
  if (shipment_id)  { where.push('shipment_id=?'); vals.push(shipment_id); }
  if (status)       { where.push('status=?'); vals.push(status); }
  if (severity)     { where.push('severity=?'); vals.push(severity); }
  if (from)         { where.push('anchor_time >= ?'); vals.push(from); }
  if (to)           { where.push('anchor_time < ?');  vals.push(to); }

  let sqlQ = '';
  if (q) {
    if (process.env.ISSUE_SEARCH_MODE === 'LIKE') {
      sqlQ = ' AND (title LIKE ? OR description LIKE ?)';
      vals.push(`%${q}%`, `%${q}%`);
    } else {
      sqlQ = ' AND MATCH(title, description) AGAINST (? IN NATURAL LANGUAGE MODE)';
      vals.push(q);
    }
  }

  const sql = `
    SELECT *
    FROM issues
    ${where.length ? 'WHERE ' + where.join(' AND ') : 'WHERE 1=1'}
    ${sqlQ}
    ORDER BY anchor_time DESC, id DESC
    LIMIT ${Math.min(Number(limit) || 100, 500)}
  `;
  const [rows] = await db.query(sql, vals);
  res.json(rows);
};

// =============== Get one ===============
exports.getOne = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM issues WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
};

// === Resolve context & anchor_time based on type and selected time ===
async function resolveContext(payload) {
  const out = {
    type: payload.type,
    rig_id: payload.rig_id ?? null,
    reading_id: payload.reading_id ?? null,
    lot_id: payload.lot_id ?? null,
    vessel_id: payload.vessel_id ?? null,
    vessel_position_id: payload.vessel_position_id ?? null,
    shipment_id: payload.shipment_id ?? null,
    anchor_time: null,
  };

  // ใช้เวลา anchor ที่ผู้ใช้ส่งมา (หรือเวลาปัจจุบันถ้าไม่ส่งมา)
  const ts = normalizeObservedAt(payload.anchor_time) || mysqlDateTimeBKK();

  // ----- OIL : หา product_readings ที่ "ใกล้" เวลา ts ของแท่นนั้น -----
  if (out.type === 'oil') {
    if (!out.rig_id) throw new Error('rig_id required for type=oil');

    // ถ้าบังคับส่ง reading_id มา → ตรวจสอบแล้วใช้ตัวนั้น
    if (out.reading_id) {
      const [[r]] = await db.query(
        'SELECT rig_id, lot_id, recorded_at FROM product_readings WHERE id=? AND rig_id=?',
        [out.reading_id, out.rig_id]
      );
      if (!r) throw new Error('reading_id not found for this rig');
      out.lot_id = r.lot_id ?? out.lot_id;
      out.anchor_time = r.recorded_at;
      return out;
    }

    // ปกติ: เลือกตัวที่ใกล้ ts ที่สุด (ภายใน WINDOW_SEC)
    const nearest = await findNearestReadingAt(out.rig_id, ts);
    if (nearest) {
      out.reading_id = nearest.id;
      out.lot_id = nearest.lot_id ?? out.lot_id;
      // ให้ anchor_time สัมพันธ์กับ reading จริง
      out.anchor_time = nearest.recorded_at;
    } else {
      // ถ้าไม่พบเลย ก็ยึดเวลาที่ผู้ใช้เลือกไว้
      out.anchor_time = ts;
    }
    return out;
  }

  // ----- LOT : เหมือนเดิม -----
  if (out.type === 'lot') {
    if (!out.lot_id) throw new Error('lot_id required for type=lot');
    const [[lot]] = await db.query('SELECT rig_id, lot_date FROM product_lots WHERE id=?', [out.lot_id]);
    if (!lot) throw new Error('lot not found');
    out.rig_id = lot.rig_id ?? out.rig_id;

    const [[r]] = await db.query(
      'SELECT MAX(recorded_at) AS last_ts FROM product_readings WHERE lot_id=?',
      [out.lot_id]
    );
    out.anchor_time = r?.last_ts || lot.lot_date || ts;
    return out;
  }

  // ----- VESSEL : หา position ใกล้ ts ที่สุด -----
  if (out.type === 'vessel') {
    if (!out.vessel_id) throw new Error('vessel_id required for type=vessel');

    if (out.vessel_position_id) {
      const [[p]] = await db.query(
        'SELECT recorded_at FROM vessel_positions WHERE id=? AND vessel_id=?',
        [out.vessel_position_id, out.vessel_id]
      );
      if (!p) throw new Error('vessel_position_id not found for this vessel');
      out.anchor_time = p.recorded_at;
      return out;
    }

    const pos = await findNearestVesselPosAt(out.vessel_id, ts);
    if (pos) {
      out.vessel_position_id = pos.id;
      out.anchor_time = pos.recorded_at;
    } else {
      out.anchor_time = ts;
    }
    return out;
  }

  // ----- SHIPMENT : เดิม -----
  if (out.type === 'shipment') {
    if (out.shipment_id) {
      const [[s]] = await db.query(
        'SELECT vessel_id, COALESCE(arrive_at, depart_at, created_at) AS ts FROM shipments WHERE id=?',
        [out.shipment_id]
      );
      if (s) {
        out.vessel_id = out.vessel_id ?? s.vessel_id ?? null;
        out.anchor_time = s.ts || ts;
      } else {
        out.anchor_time = ts;
      }
    } else {
      out.anchor_time = ts;
    }
    return out;
  }

  // fallback
  out.anchor_time = ts;
  return out;
}


// =============== Create ===============
exports.create = async (req, res) => {
  try {
    const { type, severity = 'low', title, description = '' } = req.body;
    if (!['oil','lot','vessel','shipment'].includes(type)) {
      return res.status(400).json({ message: 'invalid type' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: 'description required' });
    }
    if (!title) return res.status(400).json({ message: 'title required' });

    const ctx = await resolveContext({ ...req.body, type });
    const reported_by = req.user?.id || 1;

    const [r] = await db.query(
      `INSERT INTO issues
        (type, rig_id, reading_id, lot_id, vessel_id, vessel_position_id, shipment_id,
        severity, title, description, reported_by, anchor_time,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        ctx.type, ctx.rig_id, ctx.reading_id, ctx.lot_id, ctx.vessel_id, ctx.vessel_position_id, ctx.shipment_id,
        severity, title, description, reported_by, ctx.anchor_time
      ]
    );


    const [row] = await db.query('SELECT * FROM issues WHERE id=?', [r.insertId]);
    res.status(201).json(row[0]);
  } catch (e) {
    console.error('ISSUE CREATE ERROR:', e);
    res.status(400).json({ message: e.message || 'create failed' });
  }
};

// =============== Update ===============
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  try {
    const [[curr]] = await db.query('SELECT status FROM issues WHERE id=? LIMIT 1', [id]);
    if (!curr) return res.status(404).json({ message: 'Issue not found' });

    // ห้ามแก้ถ้าอนุมัติไปแล้ว
    if (curr.status === 'approved' && status && status !== curr.status) {
      return res.status(409).json({ message: 'Approved issues are immutable' });
    }

    // ตรวจค่าถูกชุด
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // ถ้าจะ set เป็น approved ต้องเป็น manager หรือ admin เท่านั้น
    if (status === 'approved' && !['manager','admin'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only manager or admin can approve.' });
    }

    const newStatus = status ?? curr.status;
    await db.query('UPDATE issues SET status=?, updated_at=NOW() WHERE id=?', [newStatus, id]);
    return res.json({ ok: true, id, status: newStatus });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'DB error' });
  }
};

