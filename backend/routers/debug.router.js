const express = require('express');

const router = express.Router();

// Intentional test route for verifying server error page behavior.
router.get('/force-error', (req, res, next) => {
  next(new Error('Intentional test error'));
});

module.exports = router;
