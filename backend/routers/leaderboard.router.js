const express = require('express');
const { getLeaderboard, getStreak } = require('../controllers/leaderboard.controller.js');
const router = express.Router();

router.get('/leaderboard', getLeaderboard);
router.get('/streak', getStreak);

module.exports = router;
