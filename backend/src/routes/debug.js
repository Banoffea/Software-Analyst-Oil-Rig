const router = require('express').Router();
const db = require('../db');

// summary: นับจำนวนแถวในแต่ละตารางหลัก
router.get('/summary', async (_req, res) => {
  try {
    const tables = [
      'vessels','vessel_positions','oil_rigs','product_lots',
      'product_readings','shipments','shipment_items','issues','users'
    ];
    const out = {};
    for (const t of tables) {
      const [r] = await db.query(`SELECT COUNT(*) AS c FROM ${t}`);
      out[t] = r[0].c;
    }
    res.json({ ok:true, summary: out });
  } catch (e) {
    console.error('DEBUG /summary', e);
    res.status(500).json({ ok:false, error: String(e?.message||e) });
  }
});

// vessels-raw: what /api/vessels ควรจะส่ง (ดึงตรง DB)
router.get('/vessels-raw', async (_req, res) => {
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
    res.json(rows);
  } catch (e) {
    console.error('DEBUG /vessels-raw', e);
    res.status(500).json({ ok:false, error: String(e?.message||e) });
  }
});

// echo เวอร์ชัน: บอก env, baseURL, เวลา
router.get('/env', (_req, res) => {
  res.json({
    ok:true,
    node: process.version,
    db_host: process.env.DB_HOST,
    db_database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE,
    now_server_local: new Date().toString()
  });
});

module.exports = router;
