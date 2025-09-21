const db = require('../db');

exports.listByRig = async (req, res) => {
  const rigId = req.params.rigId;
  const limit = Math.min(parseInt(req.query.limit || '30', 10), 200);
  const [rows] = await db.query(
    `SELECT id, lot_date, status, total_qty
     FROM product_lots
     WHERE rig_id = ?
     ORDER BY lot_date DESC
     LIMIT ?`,
    [rigId, limit]
  );
  res.json(rows);
};
