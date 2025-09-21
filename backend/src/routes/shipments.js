const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/shipmentsController');

// ✅ เพิ่มสองบรรทัดนี้
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

router.post('/', ctrl.create);
router.post('/:id/items', ctrl.addItems);
router.post('/:id/depart', ctrl.depart);
router.post('/:id/arrive', ctrl.arrive);

module.exports = router;
