const express = require('express');
const {
  downloadData,
  downloadCalendar,
} = require('../controllers/csvDownload.controller.js');
const { authenticate } = require('../middleware/auth.js');

const router = express.Router();

router.get('/download', authenticate, downloadData);
router.get('/download/calendar', authenticate, downloadCalendar);

module.exports = router;
