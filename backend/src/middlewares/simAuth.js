// backend/src/middlewares/simAuth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

exports.simAuth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.simUser = payload; // { uid, username, role }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }
};

exports.simRequireAnyRole = (...roles) => (req, res, next) => {
  if (!req.simUser) return res.status(401).json({ message: 'Unauthenticated' });
  if (roles.length && !roles.includes(req.simUser.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};
