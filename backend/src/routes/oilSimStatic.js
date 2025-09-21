// backend/src/routes/oilSimStatic.js
const express = require('express');
const path = require('path');
const router = express.Router();

const root = path.join(__dirname, '../../public/oil-sim');
router.get('/', (_req, res) => res.sendFile(path.join(root, 'index.html')));
router.use(express.static(root));

module.exports = router;
