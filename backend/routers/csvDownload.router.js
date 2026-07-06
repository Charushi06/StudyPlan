const express = require('express');
const {
  downloadData,
  downloadCalendar,
} = require('../controllers/csvDownload.controller.js');

const router = express.Router();

router.get('/download', downloadData);
router.get('/download/calendar', downloadCalendar);

module.exports = router;
