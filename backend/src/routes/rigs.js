// backend/src/routes/rigs.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/rigsController');
const { requireAuth, requireAnyRole } = require('../middlewares/requireAuth');

// อ่านอย่างเดียวให้ทุกคนที่ล็อกอินใช้ได้ก็ได้ (หรือจะล็อกไว้เฉพาะ admin/manager ก็เปลี่ยนเป็น requireAnyRole)
router.get('/', requireAuth, ctrl.list);

// จัดการ (create/update/delete) จำกัดเฉพาะ manager, admin
router.post('/',  requireAnyRole('manager','admin'), ctrl.create);
router.patch('/:id', requireAnyRole('manager','admin'), ctrl.update);
router.delete('/:id', requireAnyRole('manager','admin'), ctrl.remove);

module.exports = router;
