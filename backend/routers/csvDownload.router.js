const express = require("express");
const { downloadData } = require("../controllers/csvDownload.controller.js")
const { authRequired } = require("../../auth");

const router = express.Router();

// [GET] /api/download
router.get("/download", authRequired, downloadData);

module.exports = router;