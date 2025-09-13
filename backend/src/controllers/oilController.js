// src/controllers/oilController.js
const pool = require('../db');

const getDaily = async (req, res) => {
  try {
    const date = req.params.date || new Date().toISOString().slice(0,10);
    const [rows] = await pool.query('SELECT * FROM oil_components WHERE record_date = ?', [date]);
    res.json({ date, items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createComponent = async (req, res) => {
  try {
    const { record_date, component_name, value, unit } = req.body;
    const [result] = await pool.query(
      'INSERT INTO oil_components (record_date, component_name, value, unit) VALUES (?, ?, ?, ?)',
      [record_date, component_name, value, unit || 'unit']
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDaily, createComponent };
