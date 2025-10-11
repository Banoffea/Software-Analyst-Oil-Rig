// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const db  = require('../db');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'token'; // ✅ รวมเป็นชื่อเดียวกับ middleware

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',  // dev + Vite proxy
    secure: false,    // ใช้ true เมื่ออยู่หลัง HTTPS
    path: '/',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

exports.login = async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    if (!username || !password) return res.status(400).json({ message: 'username & password required' });

    // ตรวจคอลัมน์ที่มีจริงในตาราง users เพื่อประกอบ SQL ให้ไม่พัง
    const [colsRows] = await db.query('SHOW COLUMNS FROM users');
    const cols = new Set(colsRows.map(r => r.Field));

    // คอลัมน์ที่ใช้โชว์ชื่อ
    const nameCol = cols.has('display_name') ? 'display_name'
                  : cols.has('name')        ? 'name'
                  : 'username';

    // เงื่อนไขรหัสผ่าน: รองรับทั้ง password_hash (SHA2) และ/หรือ password (plain)
    const hasHash  = cols.has('password_hash');
    const hasPlain = cols.has('password');

    if (!hasHash && !hasPlain) {
      return res.status(500).json({ message: 'users table has no password column' });
    }

    let wherePass = [];
    let params    = [username];

    if (hasHash)  { wherePass.push('password_hash = SHA2(?,256)'); params.push(password); }
    if (hasPlain) { wherePass.push('password = ?');                params.push(password); }

    const sql = `
      SELECT id, username, ${nameCol} AS display_name, role
      FROM users
      WHERE username = ?
        AND (${wherePass.join(' OR ')})
      LIMIT 1
    `;
    const [rows] = await db.query(sql, params);
    const u = rows[0];
    if (!u) return res.status(401).json({ message: 'Login Failed' });

    // ✅ payload เดียวกัน
    const token = jwt.sign(
      { id: u.id, username: u.username, name: u.display_name, role: u.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);
    res.json({ user: { id: u.id, username: u.username, display_name: u.display_name, role: u.role } });
  } catch (e) {
    console.error('[auth:login]', e);
    res.status(500).json({ message: 'Login failed' });
  }
};

exports.me = (req, res) => {
  // ✅ ใช้ req.user จาก middleware โดยตรง
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const { id, username, name, role } = req.user;
  res.json({ user: { id, username, display_name: name, role } });
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  res.json({ ok: true });
};
