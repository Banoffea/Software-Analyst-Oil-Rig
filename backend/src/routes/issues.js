// backend/src/routes/issues.js
const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const auth = require('../middlewares/authMiddleware');
// Make sure this file actually exists: backend/src/controllers/issuesController.js
const issues = require('../controllers/issuesController');

// ---------- uploads dir (backend/src/uploads/issues) ----------
const uploadsDir = path.join(__dirname, '..', 'uploads', 'issues');
fs.mkdirSync(uploadsDir, { recursive: true });

// ---------- Multer config (images only, 10 MB) ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ---------- REST routes ----------
router.get('/',      auth, issues.list);
router.get('/:id',   auth, issues.getOne);
router.post('/',     auth, issues.create);
router.patch('/:id', auth, issues.update);

// work/approval flow
router.post('/:id/submit',  auth, upload.array('photos', 10), issues.submitReport);
router.post('/:id/approve', auth, issues.approveIssue);
router.post('/:id/reject',  auth, issues.rejectIssue);

module.exports = router;
