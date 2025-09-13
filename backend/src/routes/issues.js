// src/routes/issues.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const issueController = require('../controllers/issueController');

router.get('/', auth, issueController.list);
router.post('/', auth, issueController.create);
router.put('/:id/status', auth, issueController.updateStatus);

module.exports = router;
