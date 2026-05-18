const express = require('express');
const { extractTasks } = require('../controllers/extract.controller.js');

const router = express.Router();

router.post('/', extractTasks);

module.exports = router;
