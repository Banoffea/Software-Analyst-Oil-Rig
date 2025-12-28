// src/controllers/vesselController.js
const pool = require('../db');

const list = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vessels ORDER BY last_reported DESC');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const get = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vessels WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const create = async (req, res) => {
  try {
    const { vessel_no, name, lat, lng, speed, oil_volume } = req.body;
    const [r] = await pool.query('INSERT INTO vessels (vessel_no, name, lat, lng, speed, oil_volume) VALUES (?, ?, ?, ?, ?, ?)',
      [vessel_no, name, lat, lng, speed, oil_volume]);
    res.json({ id: r.insertId });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const update = async (req, res) => {
  try {
    const id = req.params.id;
    const fields = req.body;
    const sets = [], values = [];
    for (let k in fields) { sets.push(`${k} = ?`); values.push(fields[k]); }
    values.push(id);
    const sql = `UPDATE vessels SET ${sets.join(', ')} WHERE id = ?`;
    await pool.query(sql, values);
    res.json({ message: 'updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

module.exports = { list, get, create, update };
