const express = require('express');
const { getMoodSuggestion } = require('../controllers/mood.controller.js');
const router = express.Router();

router.post('/mood', getMoodSuggestion);

module.exports = router;
