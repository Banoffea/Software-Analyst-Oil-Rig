const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/vesselsController');

// อย่าให้ /:id มาคั่น route ที่ยาวกว่า
router.get('/positions/latest', auth, ctrl.latestPositions); // GET /api/vessels/positions/latest

// CRUD
router.get('/',  auth, ctrl.list);     // GET /api/vessels
router.post('/', auth, ctrl.create);

// เส้นที่มี :id ให้ไว้ "ท้าย" เสมอ
router.get('/:id/positions', auth, ctrl.track);         // GET /api/vessels/123/positions
router.put('/:id/position',  auth, ctrl.updatePosition);
router.get('/:id',  auth, ctrl.get);

// ✅ ใช้ PUT /:id สำหรับแก้ไขเรือ (ให้ controller เช็ค role=admin)
router.put('/:id', auth, ctrl.update);

// (option ถ้าจำเป็นสำหรับ simulator/tools)
router.post('/positions',       ctrl.addPosition);
router.post('/positions/bulk',  ctrl.addPositionsBulk);

module.exports = router;
