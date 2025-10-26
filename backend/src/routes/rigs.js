// backend/src/routes/rigs.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/rigsController');
const { requireAuth, requireAnyRole } = require('../middlewares/requireAuth');

// อ่าน: ให้ทุกคนที่ล็อกอินใช้ได้
router.get('/', requireAuth, ctrl.list);

// create/delete: จำกัด manager, admin
router.post('/',  requireAnyRole('manager','admin'), ctrl.create);

// ✅ อนุญาต production เรียก PATCH ได้ด้วย
// (ข้อจำกัดว่าแก้ได้เฉพาะ status ไปคุมใน controller แล้ว)
router.patch('/:id', requireAnyRole('manager','admin','production'), ctrl.update);

router.delete('/:id', requireAnyRole('manager','admin'), ctrl.remove);

module.exports = router;
