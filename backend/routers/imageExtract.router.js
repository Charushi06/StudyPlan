const express = require('express');
const multer = require('multer');
const { extractFromImage } = require('../controllers/imageExtract.controller.js');

const router = express.Router();

// Memory storage only — the buffer is used in-process for the Gemini/OCR
// call and discarded when the request ends, so there are no temp files
// written to disk that would need cleanup.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG/JPG images are supported'));
    }
  },
});

router.post('/extract/image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large (max 8MB)'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, extractFromImage);

module.exports = router;
