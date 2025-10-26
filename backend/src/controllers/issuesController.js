// backend/src/controllers/issuesController.js
const db = require('../db');
const sharp = require('sharp'); // <-- compress/resize before storing BLOBs

const VALID_STATUSES = [
  'in_progress',
  'need_rework',
  'awaiting_fleet_approval',
  'awaiting_manage_approval',
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

// configurable window (seconds) for "nearest" selection
const WINDOW_SEC = Number(process.env.ISSUE_READING_WINDOW_SEC || 1800); // 30 minutes

// ---- nearest helpers ----
async function findNearestReadingAt(rigId, ts) {
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

// =============== List ===============
exports.list = async (req, res) => {
  const { type, rig_id, vessel_id, lot_id, shipment_id, status, severity, from, to, q, limit = 100 } = req.query;

  const where = [];
  const vals = [];

  // role filter
  const role = req.user?.role;
  if (role === 'production') {
    where.push("(i.type IN ('oil','lot'))");
  } else if (role === 'captain' || role === 'fleet') {
    where.push("(i.type IN ('vessel','shipment'))");
  }
  // admin/manager see all

  if (type)         { where.push('i.type=?'); vals.push(type); }
  if (rig_id)       { where.push('i.rig_id=?'); vals.push(rig_id); }
  if (vessel_id)    { where.push('i.vessel_id=?'); vals.push(vessel_id); }
  if (lot_id)       { where.push('i.lot_id=?'); vals.push(lot_id); }
  if (shipment_id)  { where.push('i.shipment_id=?'); vals.push(shipment_id); }
  if (status)       { where.push('i.status=?'); vals.push(status); }
  if (severity)     { where.push('i.severity=?'); vals.push(severity); }
  if (from)         { where.push('i.anchor_time >= ?'); vals.push(from); }
  if (to)           { where.push('i.anchor_time < ?');  vals.push(to); }

  let sqlQ = '';
  if (q) {
    if (process.env.ISSUE_SEARCH_MODE === 'LIKE') {
      sqlQ = ' AND (i.title LIKE ? OR i.description LIKE ?)';
      vals.push(`%${q}%`, `%${q}%`);
    } else {
      sqlQ = ' AND MATCH(i.title, i.description) AGAINST (? IN NATURAL LANGUAGE MODE)';
      vals.push(q);
    }
  }

  const sql = `
    SELECT
      i.*,
      u.display_name AS reported_by_name
    FROM issues i
    LEFT JOIN users u ON u.id = i.reported_by
    ${where.length ? 'WHERE ' + where.join(' AND ') : 'WHERE 1=1'}
    ${sqlQ}
    ORDER BY i.anchor_time DESC, i.id DESC
    LIMIT ${Math.min(Number(limit) || 100, 500)}
  `;
  const [rows] = await db.query(sql, vals);
  res.json(rows);
};

// =============== Get one ===============
exports.getOne = async (req, res) => {
  const [rows] = await db.query(
    `SELECT i.*, u.display_name AS reported_by_name
       FROM issues i
  LEFT JOIN users u ON u.id = i.reported_by
      WHERE i.id=?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  const issue = rows[0];

  // return photo API URLs (no bytes in payload)
  const [photos] = await db.query(
    'SELECT id FROM issue_photos WHERE issue_id=? ORDER BY id',
    [issue.id]
  );
  issue.photos = photos.map(p => ({ id: p.id, file_path: `/api/issues/photo/${p.id}` }));
  res.json(issue);
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

  const ts = normalizeObservedAt(payload.anchor_time) || mysqlDateTimeBKK();

  if (out.type === 'oil') {
    if (!out.rig_id) throw new Error('rig_id required for type=oil');
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
    const nearest = await findNearestReadingAt(out.rig_id, ts);
    if (nearest) {
      out.reading_id = nearest.id;
      out.lot_id = nearest.lot_id ?? out.lot_id;
      out.anchor_time = nearest.recorded_at;
    } else {
      out.anchor_time = ts;
    }
    return out;
  }

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
    if (!title) return res.status(400).json({ message: 'title required' });

    // Admin view-only
    if (req.user?.role === 'admin') {
      return res.status(403).json({ message: 'Admins cannot create issues' });
    }

    const ctx = await resolveContext({ ...req.body, type });
    const reported_by = req.user?.id || 1;

    const [r] = await db.query(
      `INSERT INTO issues
        (type, rig_id, reading_id, lot_id, vessel_id, vessel_position_id, shipment_id,
         severity, status, title, description, reported_by, anchor_time,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, NOW(), NOW())`,
      [
        ctx.type, ctx.rig_id, ctx.reading_id, ctx.lot_id, ctx.vessel_id, ctx.vessel_position_id, ctx.shipment_id,
        severity, title, description, reported_by, ctx.anchor_time
      ]
    );

    const [[row]] = await db.query('SELECT * FROM issues WHERE id=?', [r.insertId]);
    res.status(201).json(row);
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

    if (curr.status === 'approved' && status && status !== curr.status) {
      return res.status(409).json({ message: 'Approved issues are immutable' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Only MANAGER can move to approved — admin cannot
    if (status === 'approved' && req.user?.role !== 'manager') {
      return res.status(403).json({ message: 'Only manager can approve.' });
    }

    const newStatus = status ?? curr.status;
    await db.query('UPDATE issues SET status=?, updated_at=NOW() WHERE id=?', [newStatus, id]);
    return res.json({ ok: true, id, status: newStatus });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'DB error' });
  }
};

// helper
function nextStatusAfterSubmit(type){
  return (type === 'oil' || type === 'lot') ? 'awaiting_manage_approval' : 'awaiting_fleet_approval';
}

// =============== Submit report (stores photos in DB) ===============
exports.submitReport = async (req, res) => {
  const id = Number(req.params.id);
  const { finish_time, action_report } = req.body;
  const role = req.user?.role;

  const [[row]] = await db.query('SELECT id, type, status FROM issues WHERE id=?', [id]);
  if (!row) return res.status(404).json({ message: 'Not found' });

  // Who may submit (admin = NO):
  const isProd        = role === 'production' && (row.type === 'oil' || row.type === 'lot');
  const isVesselTeam  = (role === 'captain' || role === 'fleet') && (row.type === 'vessel' || row.type === 'shipment');
  const isManager     = role === 'manager';
  if (!(isProd || isVesselTeam || isManager)) {
    return res.status(403).json({ message: 'Not allowed to submit' });
  }

  if (!['in_progress','need_rework'].includes(row.status)) {
    return res.status(409).json({ message: 'This report is not editable in current status' });
  }
  if (!action_report || !action_report.trim()) {
    return res.status(400).json({ message: 'action_report required' });
  }

  await db.query(
    'UPDATE issues SET action_report=?, finish_time=?, status=?, updated_at=NOW() WHERE id=?',
    [action_report.trim(), finish_time || null, nextStatusAfterSubmit(row.type), id]
  );

  // Save images into DB (BLOB) — insert ONE BY ONE with compression to keep packets small
  if (req.files?.length) {
    for (const f of req.files) {
      try {
        // Re-encode to JPEG and cap dimensions to reduce size
        const jpegBuf = await sharp(f.buffer)
          .rotate()
          .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();

        const safeName = (f.originalname || 'image').replace(/[^\w.\-]+/g, '_');
        await db.query(
          'INSERT INTO issue_photos (issue_id, filename, mime, bytes) VALUES (?, ?, ?, ?)',
          [id, safeName, 'image/jpeg', jpegBuf]
        );
      } catch (e) {
        console.error('PHOTO SAVE ERROR:', e.message);
        // continue; don't fail the whole submit because one image failed
      }
    }
  }

  res.json({ ok: true, id, status: nextStatusAfterSubmit(row.type) });
};

// =============== Approve / Reject ===============
exports.approveIssue = async (req, res) => {
  const id = Number(req.params.id);
  const role = req.user?.role;

  const [[row]] = await db.query('SELECT id, status, finish_time FROM issues WHERE id=?', [id]);
  if (!row) return res.status(404).json({ message: 'Not found' });

  // Stage 1: fleet only
  if (row.status === 'awaiting_fleet_approval') {
    if (role !== 'fleet') {
      return res.status(403).json({ message: 'Only fleet can approve here' });
    }
    await db.query('UPDATE issues SET status=?, updated_at=NOW() WHERE id=?', ['awaiting_manage_approval', id]);
    return res.json({ ok: true, status: 'awaiting_manage_approval' });
  }

  // Final: manager only (admin/captain/fleet blocked)
  if (row.status === 'awaiting_manage_approval') {
    if (role !== 'manager') {
      return res.status(403).json({ message: 'Only manager can approve here' });
    }
    await db.query(`
      UPDATE issues
         SET status='approved',
             finish_time = COALESCE(finish_time, NOW()),
             updated_at = NOW()
       WHERE id=?`, [id]);
    const [[after]] = await db.query('SELECT status, finish_time FROM issues WHERE id=?', [id]);
    return res.json({ ok: true, status: after.status, finish_time: after.finish_time });
  }

  return res.status(409).json({ message: 'Invalid state for approval' });
};

exports.rejectIssue = async (req, res) => {
  const id = Number(req.params.id);
  const role = req.user?.role;

  const [[row]] = await db.query('SELECT id, status FROM issues WHERE id=?', [id]);
  if (!row) return res.status(404).json({ message: 'Not found' });

  if (row.status === 'awaiting_manage_approval') {
    if (role !== 'manager') return res.status(403).json({ message: 'Only manager can reject here' });
  } else if (row.status === 'awaiting_fleet_approval') {
    if (role !== 'fleet') return res.status(403).json({ message: 'Only fleet can reject here' });
  } else {
    return res.status(409).json({ message: 'Invalid state for reject' });
  }

  await db.query('DELETE FROM issue_photos WHERE issue_id=?', [id]);
  await db.query('UPDATE issues SET action_report=NULL, finish_time=NULL, status=?, updated_at=NOW() WHERE id=?', ['need_rework', id]);

  res.json({ ok: true, status: 'need_rework' });
};

// =============== Stream photo (from DB) ===============
exports.streamPhoto = async (req, res) => {
  const photoId = Number(req.params.photoId);
  const [[row]] = await db.query(
    'SELECT mime, bytes FROM issue_photos WHERE id=? LIMIT 1',
    [photoId]
  );
  if (!row) return res.status(404).end();
  res.setHeader('Content-Type', row.mime || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.end(row.bytes);
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'invalid id' });

    // มีไหม?
    const [[exists]] = await db.query('SELECT id FROM issues WHERE id=? LIMIT 1', [id]);
    if (!exists) return res.status(404).json({ message: 'not found' });

    // ลบความเกี่ยวข้องต่าง ๆ ถ้ามี (ไม่ error ถ้าตารางไม่มี)
    try { await db.query('DELETE FROM issue_photos WHERE issue_id=?', [id]); } catch {}
    try { await db.query('DELETE FROM issue_actions WHERE issue_id=?', [id]); } catch {}

    // ลบตัว issue
    await db.query('DELETE FROM issues WHERE id=?', [id]);

    return res.json({ ok: true });
  } catch (e) {
    console.error('[issues] delete error:', e);
    return res.status(500).json({ message: 'failed to delete issue' });
  }
};

module.exports = exports;
