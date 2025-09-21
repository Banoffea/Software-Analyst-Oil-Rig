// backend/src/services/lots.js

/** คืน 'YYYY-MM-DD' จาก timestamp โดยตีความเป็นเวลาไทย */
function lotDateFromBKK(ts) {
  if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
    // 'YYYY-MM-DD HH:mm:ss' หรือ ISO → เอา 10 ตัวแรกพอ
    return ts.slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ts)); // => YYYY-MM-DD
}

/** สร้าง/ดึง lot ของ (rigId, lotDate-ไทย) แล้วคืน lot_id */
async function ensureLotFor(conn, rigId, ts) {
  const lotDate = lotDateFromBKK(ts);
  // ต้องมี UNIQUE (rig_id, lot_date) ที่ตาราง product_lots
  await conn.query(
    `INSERT INTO product_lots (rig_id, lot_date, status)
     VALUES (?, ?, 'on_rig')
     ON DUPLICATE KEY UPDATE id = id`,
    [rigId, lotDate]
  );
  const [rows] = await conn.query(
    `SELECT id FROM product_lots WHERE rig_id=? AND lot_date=? LIMIT 1`,
    [rigId, lotDate]
  );
  return rows[0].id;
}

module.exports = { lotDateFromBKK, ensureLotFor };
