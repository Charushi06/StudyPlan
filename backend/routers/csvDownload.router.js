const express = require('express');
const {
  downloadData,
  reviewDownloadData,
  downloadCalendar,
} = require('../controllers/csvDownload.controller.js');

const router = express.Router();

router.get('/download', downloadData);
router.get('/downloadReview', reviewDownloadData);
router.get('/download/calendar', downloadCalendar);

module.exports = router;
