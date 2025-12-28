// backend/src/middlewares/ipAllowlist.js
function ipToLong(ip) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;
  return ip.split('.').map(Number).reduce((acc, v) => (acc << 8) + v, 0) >>> 0;
}

function cidrToRange(cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const baseLong = ipToLong(base);
  if (baseLong == null || Number.isNaN(bits)) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const start = baseLong & mask;
  const end = start + (2 ** (32 - bits)) - 1;
  return { start, end };
}

module.exports = function ipAllowlist(allowStr = '') {
  const tokens = allowStr.split(',').map(s => s.trim()).filter(Boolean);

  const matchers = tokens.map(t => {
    if (t === '*') return { any: true };
    if (t.includes('/')) {
      const range = cidrToRange(t);
      return range ? { range } : null;
    }
    if (t.includes('*')) {
      // "10.31.*" หรือ "10.31.126.*"
      const rx = new RegExp('^' + t.split('.').map(seg => seg === '*' ? '\\d{1,3}' : seg).join('\\.') + '$');
      return { regex: rx };
    }
    return { exact: t }; // exact IP
  }).filter(Boolean);

  return (req, res, next) => {
    // ใช้ x-forwarded-for ก่อน เผื่อรันหลัง proxy
    const hxff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ipRaw = (hxff || req.ip || '').replace('::ffff:', '');

    if (!matchers.length) return next(); // ไม่ได้ตั้งค่า -> ไม่บล็อก

    const pass = matchers.some(m => {
      if (m.any) return true;
      if (m.exact) return ipRaw === m.exact;
      if (m.regex) return m.regex.test(ipRaw);
      if (m.range) {
        const ipLong = ipToLong(ipRaw);
        return ipLong != null && ipLong >= m.range.start && ipLong <= m.range.end;
      }
      return false;
    });

    if (pass) return next();
    console.warn('[ipAllowlist] blocked', ipRaw, 'allowed=', allowStr);
    return res.status(403).send('Forbidden: IP not allowed');
  };
};
