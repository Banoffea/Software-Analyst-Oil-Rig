const express = require('express')
const router = express.Router()
const pool = require('../db')

// GET daily oil components
router.get('/daily/:date', async (req, res) => {
  const { date } = req.params
  try {
    const [rows] = await pool.query(
      'SELECT * FROM oil_components WHERE DATE(record_date) = ? ORDER BY record_date DESC',
      [date]
    )
    res.json({ items: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ADD new oil component record
router.post('/', async (req, res) => {
  try {
    const { component_name, value, unit } = req.body
    const [result] = await pool.query(
      'INSERT INTO oil_components (component_name, value, unit, record_date) VALUES (?, ?, ?, NOW())',
      [component_name, value, unit]
    )
    res.json({ id: result.insertId, component_name, value, unit })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
