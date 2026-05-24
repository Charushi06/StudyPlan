const express = require('express');
const { authRequired } = require('../../auth');
const {
  downloadData,
  downloadCalendar,
} = require('../controllers/csvDownload.controller.js');

const router = express.Router();

router.get('/download', authRequired, downloadData);
router.get('/download/calendar', authRequired, downloadCalendar);

module.exports = router;
