const express = require("express");
const { downloadData } = require("../controllers/dataExport.controller.js");

const router = express.Router();

// [GET] /api/download
router.get("/download", downloadData);

module.exports = router;