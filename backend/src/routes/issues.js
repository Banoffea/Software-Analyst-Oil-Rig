const express = require('express');
const router = express.Router();

const multer = require('multer');
const auth = require('../middlewares/authMiddleware');
const issues = require('../controllers/issuesController');

/**
 * Multer in-memory (store in DB as BLOB)
 *  - images only
 *  - 10MB/file
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image (adjust as needed)
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// ---------- REST routes ----------
router.get('/',        auth, issues.list);
router.get('/:id',     auth, issues.getOne);
router.post('/',       auth, issues.create);
router.patch('/:id',   auth, issues.update);

// work/approval flow
router.post('/:id/submit',   auth, upload.array('photos', 10), issues.submitReport);
router.post('/:id/approve',  auth, issues.approveIssue);
router.post('/:id/reject',   auth, issues.rejectIssue);

router.delete('/:id',        auth, issues.remove);
// stream photo bytes from DB
router.get('/photo/:photoId', auth, issues.streamPhoto);

module.exports = router;
