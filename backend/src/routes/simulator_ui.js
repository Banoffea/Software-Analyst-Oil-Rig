const express = require('express');
const path = require('path');
const router = express.Router();

// เสิร์ฟไฟล์ HTML/JS/CSS ใต้ public/sim
const root = path.join(__dirname, '../../public/sim');
router.get('/', (_req, res) => res.sendFile(path.join(root, 'index.html')));
router.use(express.static(root));

module.exports = router;
