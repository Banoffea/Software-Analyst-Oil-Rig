const db = require('../db');
const { ensureLotFor } = require('../services/lots'); // ใช้สร้าง/ดึง lot รายวัน

// เวลาไทย 'YYYY-MM-DD HH:mm:ss' (ใช้เป็น recorded_at)
const mysqlDateTimeBKK = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value.padStart(2,'0');
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
};

// ---------------- list rigs ----------------
exports.listRigs = async (_req, res) => {
  const [rows] = await db.query(
    `SELECT id, rig_code, name, status FROM oil_rigs ORDER BY id`
  );
  res.json(rows);
};

// ---------------- bulk send readings ----------------
exports.bulkGenerate = async (req, res) => {
  // body: { rig_ids: number[] }
  const rigIds = Array.isArray(req.body?.rig_ids)
    ? req.body.rig_ids.map(n => Number(n)).filter(Boolean)
    : [];
  if (!rigIds.length) return res.status(400).json({ message: 'rig_ids required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

   const [okRigs] = await conn.query(
     `SELECT id FROM oil_rigs WHERE id IN (?) AND status='online'`,
     [rigIds]
   );
   const okSet = new Set(okRigs.map(r => r.id));
   const allowedRigIds = rigIds.filter(id => okSet.has(id));
   if (!allowedRigIds.length) {
     await conn.rollback();
     return res.status(400).json({ message: 'no online rigs selected' });
   }

    const rows = [];                       // สำหรับ INSERT … VALUES ?
    const results = [];                    // ส่งกลับให้ UI โชว์
    const qtyByLot = new Map();            // สะสมยอด/lot เพื่อไป UPDATE product_lots

   for (const rigId of allowedRigIds) {
      const ts = mysqlDateTimeBKK();
      const lotId = await ensureLotFor(conn, rigId, ts);  // สร้าง/ดึง lot ของวันไทย

      // สุ่มค่า (ตามเดิม)
      const q   = +(8 + Math.random() * 4).toFixed(3);
      const t   = +(30 + Math.random() * 5).toFixed(3);
      const p   = +(100 + Math.random() * 5).toFixed(3);
      const h   = +(60 + Math.random() * 10).toFixed(3);
      const co2 = +(0.40 + Math.random() * 0.05).toFixed(3);
      const h2s = +(7 + Math.random() * 1.5).toFixed(3);
      const w   = +(0.16 + Math.random() * 0.05).toFixed(3);

      rows.push([lotId, rigId, ts, q, p, t, h, co2, h2s, w, 'normal']);
      results.push({ lot_id: lotId, rig_id: rigId, Quantity:q, Temperature:t,
                     Pressure:p, Humidity:h, CO2:co2, H2S:h2s, Water:w });

      qtyByLot.set(lotId, (qtyByLot.get(lotId) || 0) + q);
    }

    // เขียน readings
    await conn.query(
      `INSERT INTO product_readings
       (lot_id, rig_id, recorded_at, Quantity, Pressure, Temperature, Humidity, CO2, H2S, Water, ProductStatus)
       VALUES ?`,
      [rows]
    );

    // อัปเดตยอดรวมต่อ lot (ใช้ COALESCE กัน NULL)
    for (const [lotId, sumQ] of qtyByLot.entries()) {
      await conn.query(
        `UPDATE product_lots
           SET total_qty = COALESCE(total_qty,0) + ?
         WHERE id = ?`,
        [sumQ, lotId]
      );
    }

    await conn.commit();
    res.json({ inserted: rows.length, results });
  } catch (e) {
    await conn.rollback();
    console.error('oil-sim bulk error:', e);
    res.status(500).json({ message: 'DB error' });
  } finally {
    conn.release();
  }
};
