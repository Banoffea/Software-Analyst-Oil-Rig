// backend/src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

module.exports = function authMiddleware(req, _res, next) {
  const token = req.cookies?.token;     // ✅ ใช้คุกกี้ชื่อ token เสมอ
  if (!token) { req.user = null; return next(); }

  try {
    const p = jwt.verify(token, SECRET);
    // ✅ payload รูปแบบเดียวกันทุกที่
    req.user = { id: p.id, username: p.username, name: p.name, role: p.role };
  } catch {
    req.user = null;
  }
  next();
};
