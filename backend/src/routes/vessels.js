// src/routes/vessels.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const vesselController = require('../controllers/vesselController');

router.get('/', auth, vesselController.list);
router.get('/:id', auth, vesselController.get);
router.post('/', auth, vesselController.create);
router.put('/:id', auth, vesselController.update);

module.exports = router;
