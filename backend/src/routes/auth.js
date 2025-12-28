// backend/src/routes/auth.js
const express = require('express');
const ctrl = require('../controllers/authController');
const router = express.Router();

router.post('/login',  ctrl.login);
router.get('/me',      ctrl.me);
router.post('/logout', ctrl.logout);

module.exports = router;
