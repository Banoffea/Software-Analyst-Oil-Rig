// backend/src/uploads/multer.js
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error('Images only'));
    }
    cb(null, true);
  },
});

module.exports = upload;
