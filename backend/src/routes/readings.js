// backend/src/routes/readings.js
const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const ctrl   = require('../controllers/readingsController');

// ปรับพารามิเตอร์จาก FE ให้เป็นค่าปกติ
function normalize(req) {
  const q = req.query || {};

  // rigId ⟷ rig_id
  if (!q.rigId && q.rig_id) q.rigId = q.rig_id;

  // date อาจมาเป็น date[date] หรือ object
  if (!q.date && q['date[date]']) q.date = q['date[date]'];
  if (q.date && typeof q.date === 'object') {
    if (q.date.date) q.date = q.date.date; // กรณี { date: 'YYYY-MM-DD', ... }
  }

  // limit
  if (!q.limit && q['date[limit]']) q.limit = q['date[limit]'];
  if (!q.limit) q.limit = 200000;
}

// สรุปวันนี้
router.get('/summary/today', auth, ctrl.summaryToday);

// ค่าล่าสุดต่อแท่น
router.get('/latest', auth, ctrl.latestPerRig);

// ประวัติ
router.get('/history', auth, (req, res, next) => { normalize(req); return ctrl.history(req, res, next); });

// รายวัน (ตัวจริง)
router.get('/daily-series', auth, (req, res, next) => { normalize(req); return ctrl.dailySeries(req, res, next); });

// ✅ alias รองรับ FE เดิม: /daily → ใช้ dailySeries
router.get('/daily', auth, (req, res, next) => { normalize(req); return ctrl.dailySeries(req, res, next); });

router.post('/', auth, ctrl.ingestOne);   // << เพิ่ม
router.post('/bulk', auth, ctrl.ingestBulk); // << เพิ่ม

module.exports = router;
