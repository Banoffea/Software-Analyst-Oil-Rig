// src/controllers/authController.js
const pool = require('../db');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) 
      return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];

    // Plain text password (สำหรับตัวอย่าง)
    if (password !== user.password)
      return res.status(401).json({ message: 'Invalid credentials' });

    if (!process.env.JWT_SECRET)
      return res.status(500).json({ message: 'JWT secret not set' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        display_name: user.display_name, 
        role: user.role 
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { login };
