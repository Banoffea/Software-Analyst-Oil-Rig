// backend/src/controllers/readingsController.js
const db = require('../db');
const { ensureLotFor } = require('../services/lots');

/** เวลาไทย 'YYYY-MM-DD HH:mm:ss' (ใช้เมื่อไม่ได้ส่ง recorded_at มา) */
const mysqlDateTimeBKK = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value.padStart(2, '0');
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
};

/* ===================== Ingest (1 record) ===================== */
exports.ingestOne = async (req, res) => {
  const {
    rigId,
    quantity, pressure, temperature, humidity,
    co2, h2s, hg, water, productStatus,
    recorded_at
  } = req.body;

  if (!rigId) return res.status(400).json({ message: 'rigId required' });

  // ถ้า ?force_now=1 หรือ body.force_now = true → ใช้เวลาปัจจุบันเสมอ
  const useNow = req.query?.force_now === '1' || req.body?.force_now === true;
  const ts = useNow || !recorded_at ? mysqlDateTimeBKK() : recorded_at;

  const conn = await db.getConnection();
  try {
    const lotId = await ensureLotFor(conn, rigId, ts);
    await conn.query(
      `INSERT INTO product_readings
       (lot_id, rig_id, recorded_at, Quantity, Pressure, Temperature, Humidity, CO2, H2S, Hg, Water, ProductStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lotId, rigId, ts,
        quantity ?? null, pressure ?? null, temperature ?? null, humidity ?? null,
        co2 ?? null, h2s ?? null, hg ?? null, water ?? null, productStatus ?? null
      ]
    );
    if (quantity != null) {
      await conn.query(`UPDATE product_lots SET total_qty = COALESCE(total_qty,0) + ? WHERE id=?`, [quantity, lotId]);
    }
    res.json({ ok: true, lotId, recorded_at: ts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  } finally {
    conn.release();
  }
};

/* ===================== Ingest (bulk) ===================== */
exports.ingestBulk = async (req, res) => {
  const input = Array.isArray(req.body) ? req.body : [];
  const rows = input.filter(r => r && r.rigId);
  if (!rows.length) return res.status(400).json({ message: 'array with rigId required' });

  const useNow = req.query?.force_now === '1' || req.body?.force_now === true;
  const tsOf = (r) => (useNow || !r.recorded_at) ? mysqlDateTimeBKK() : r.recorded_at;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // เตรียม lot ต่อ (rigId, วันไทย)
    const lotIdMap = new Map(); // key = `${rigId}|YYYY-MM-DD`
    for (const r of rows) {
      const ts = tsOf(r);
      const key = `${r.rigId}|${ts.slice(0,10)}`;
      if (!lotIdMap.has(key)) {
        const id = await ensureLotFor(conn, r.rigId, ts);
        lotIdMap.set(key, id);
      }
    }

    const values = rows.map(r => {
      const ts = tsOf(r);
      const lotId = lotIdMap.get(`${r.rigId}|${ts.slice(0,10)}`);
      return [
        lotId,
        r.rigId,
        ts,
        r.quantity ?? null,
        r.pressure ?? null,
        r.temperature ?? null,
        r.humidity ?? null,
        r.co2 ?? null,
        r.h2s ?? null,
        r.hg ?? null,
        r.water ?? null,
        r.productStatus ?? null
      ];
    });

    await conn.query(
      `INSERT INTO product_readings
       (lot_id, rig_id, recorded_at, Quantity, Pressure, Temperature, Humidity, CO2, H2S, Hg, Water, ProductStatus)
       VALUES ?`,
      [values]
    );

    // สรุปยอด qty ต่อ lot
    const qtyByLot = {};
    rows.forEach(r => {
      if (r.quantity != null) {
        const ts = tsOf(r);
        const lotId = lotIdMap.get(`${r.rigId}|${ts.slice(0,10)}`);
        qtyByLot[lotId] = (qtyByLot[lotId] ?? 0) + Number(r.quantity);
      }
    });
    for (const [lotId, sumQ] of Object.entries(qtyByLot)) {
      await conn.query(`UPDATE product_lots SET total_qty = COALESCE(total_qty,0) + ? WHERE id=?`, [sumQ, lotId]);
    }

    await conn.commit();
    res.json({ inserted: rows.length, lots: [...new Set(values.map(v => v[0]))].length });
  } catch (e) {
    await conn.rollback();
    console.error('INGEST BULK ERROR:', {
      code: e.code, errno: e.errno, sqlState: e.sqlState, sqlMessage: e.sqlMessage
    });
    res.status(500).json({ message: 'DB error', detail: e.sqlMessage });
  } finally {
    conn.release();
  }
};

/* ===================== Summary วันนี้ (เวลาไทย) ===================== */
exports.summaryToday = async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT rig_id,
              SUM(Quantity)    AS total_qty,
              AVG(H2S)         AS avg_h2s,
              AVG(CO2)         AS avg_co2,
              AVG(Temperature) AS avg_temp
       FROM product_readings
       WHERE recorded_at >= DATE(CONVERT_TZ(NOW(), '+00:00', '+07:00'))
         AND recorded_at <  DATE(CONVERT_TZ(NOW(), '+00:00', '+07:00')) + INTERVAL 1 DAY
       GROUP BY rig_id`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
};

/* ===================== ค่า latest ต่อแท่น ===================== */
exports.latestPerRig = async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pr.*
       FROM product_readings pr
       JOIN (
         SELECT rig_id, MAX(recorded_at) AS last_ts
         FROM product_readings
         GROUP BY rig_id
       ) t ON pr.rig_id=t.rig_id AND pr.recorded_at=t.last_ts
       ORDER BY pr.rig_id`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
};

/* ===================== History ===================== */
exports.history = async (req, res) => {
  const q = req.query || {};
  const rigId = Number(q.rigId ?? q.rig_id);
  if (!rigId) return res.status(400).json({ message: 'rigId required' });

  let date = q.date ?? q['date[date]'];
  if (date && typeof date === 'object') date = date.date;

  const limit = Math.min(parseInt(q.limit || '100000', 10), 200000);

  let sql = `
    SELECT rig_id, recorded_at, Quantity, Temperature, Pressure, Humidity, H2S, CO2, Water
    FROM product_readings
    WHERE rig_id = ?`;
  const vals = [rigId];

  if (date) {
    sql += ` AND recorded_at >= ? AND recorded_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    vals.push(`${date} 00:00:00`, date);
  } else {
    const { from, to } = q;
    if (from) { sql += ` AND recorded_at >= ?`; vals.push(from); }
    if (to)   { sql += ` AND recorded_at <  ?`; vals.push(to);   }
  }

  sql += ` ORDER BY recorded_at ASC LIMIT ${limit}`;

  try {
    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
};

/* ===================== Daily Series ===================== */
exports.dailySeries = async (req, res) => {
  const q = req.query || {};
  const rigId = Number(q.rigId ?? q.rig_id);
  let date = q.date ?? q['date[date]'];
  if (date && typeof date === 'object') date = date.date;

  if (!rigId || !date) return res.status(400).json({ message: 'rigId & date required' });

  const from = `${date} 00:00:00`;
  const to   = date;

  const [rows] = await db.query(
    `
    SELECT
      DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i') AS m,
      AVG(Quantity)     AS Quantity,
      AVG(Temperature)  AS Temperature,
      AVG(Pressure)     AS Pressure,
      AVG(Humidity)     AS Humidity,
      AVG(CO2)          AS CO2,
      AVG(H2S)          AS H2S,
      AVG(Water)        AS Water
    FROM product_readings
    WHERE rig_id = ?
      AND recorded_at >= ?
      AND recorded_at <  DATE_ADD(?, INTERVAL 1 DAY)
    GROUP BY m
    ORDER BY m
    `,
    [rigId, from, to]
  );

  const labels = [];
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) labels.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  const byMinute = new Map(rows.map(r => [r.m.slice(11, 16), r]));
  const pick = (k) => labels.map(t => (byMinute.get(t) ? Number(byMinute.get(t)[k]) : null));

  res.json({
    date,
    labels,
    series: {
      quantity:    pick('Quantity'),
      temperature: pick('Temperature'),
      pressure:    pick('Pressure'),
      humidity:    pick('Humidity'),
      co2:         pick('CO2'),
      h2s:         pick('H2S'),
      water:       pick('Water'),
    },
  });
};
